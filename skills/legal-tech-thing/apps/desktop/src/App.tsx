import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loginWithPassword, logoutWithRefreshToken } from "./auth/api";
import {
  clearStoredAuthTokens,
  getStoredAuthTokens,
  setStoredAuthTokens,
  type AuthTokens
} from "./auth/token-store";
import { submitClipboardContractSource, submitDesktopOcrContractSource } from "./contracts/api";
import { extractTextFromCapturedImage } from "./ocr/pipeline";
import {
  enqueuePendingScan,
  loadPendingScanQueue,
  removePendingScanById,
  updatePendingScanAttempt,
  type PendingScanItem
} from "./sync/offline-queue";

function formatTokenPreview(token: string) {
  if (token.length <= 16) {
    return token;
  }

  return `${token.slice(0, 8)}...${token.slice(-8)}`;
}

type FindingSeverity = "critical" | "high" | "medium" | "low";

type FindingRule = {
  id: string;
  title: string;
  severity: FindingSeverity;
  rationale: string;
  pattern: RegExp;
};

type DesktopFinding = {
  id: string;
  ruleId: string;
  title: string;
  severity: FindingSeverity;
  rationale: string;
  startOffset: number;
  endOffset: number;
  excerpt: string;
};

const FINDING_RULES: FindingRule[] = [
  {
    id: "arbitration",
    title: "Arbitration clause detected",
    severity: "high",
    rationale: "Arbitration clauses can waive court access and jury trial rights.",
    pattern: /\barbitration\b/gi
  },
  {
    id: "class-action-waiver",
    title: "Class action waiver language",
    severity: "high",
    rationale: "Class action waivers can limit collective legal recourse.",
    pattern: /\bclass action waiver\b|\bwaive(?:r)? .*class action\b/gi
  },
  {
    id: "indemnity",
    title: "Indemnity obligation",
    severity: "high",
    rationale: "Indemnity terms may shift broad legal liability to the signer.",
    pattern: /\bindemnif(?:y|ication)\b/gi
  },
  {
    id: "liability-cap",
    title: "Limitation of liability",
    severity: "medium",
    rationale: "Liability caps can materially reduce available remedies.",
    pattern: /\blimitation of liability\b|\bliability(?: is)? limited\b/gi
  },
  {
    id: "auto-renewal",
    title: "Auto-renewal language",
    severity: "medium",
    rationale: "Automatic renewal can extend commitments without explicit consent.",
    pattern: /\bauto(?:matic)? renew(?:al)?\b/gi
  },
  {
    id: "governing-law",
    title: "Governing law jurisdiction",
    severity: "low",
    rationale: "Jurisdiction terms affect where disputes must be handled.",
    pattern: /\bgoverning law\b|\bjurisdiction\b/gi
  }
];

function buildFindingsFromText(text: string) {
  const findings: DesktopFinding[] = [];

  for (const rule of FINDING_RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null = regex.exec(text);
    let matchCount = 0;

    while (match && match.index >= 0 && matchCount < 20) {
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      const excerptStart = Math.max(0, startOffset - 90);
      const excerptEnd = Math.min(text.length, endOffset + 90);
      const excerpt = text.slice(excerptStart, excerptEnd).replace(/\s+/g, " ").trim();

      findings.push({
        id: `${rule.id}-${startOffset}-${endOffset}`,
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        rationale: rule.rationale,
        startOffset,
        endOffset,
        excerpt
      });

      matchCount += 1;
      match = regex.exec(text);
    }
  }

  const severityRank: Record<FindingSeverity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  return findings.sort((left, right) => {
    const rankDelta = severityRank[right.severity] - severityRank[left.severity];
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return left.startOffset - right.startOffset;
  });
}

function toErrorCode(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "UNKNOWN_ERROR";
}

function isLikelyOfflineFailure(errorCode: string) {
  const normalized = errorCode.trim().toUpperCase();
  return (
    !window.navigator.onLine ||
    normalized.includes("FAILED TO FETCH") ||
    normalized.includes("NETWORK") ||
    normalized.includes("ERR_INTERNET_DISCONNECTED") ||
    normalized.includes("ERR_NETWORK_CHANGED")
  );
}

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [importedFiles, setImportedFiles] = useState<ImportedContractFile[]>([]);
  const [isImportingFiles, setIsImportingFiles] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [capturedScreen, setCapturedScreen] = useState<CapturedScreenResult | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [regionCaptureDataUrl, setRegionCaptureDataUrl] = useState<string | null>(null);
  const [isRunningOcr, setIsRunningOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<"all" | FindingSeverity>("all");
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [isSubmittingClipboard, setIsSubmittingClipboard] = useState(false);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [clipboardStatus, setClipboardStatus] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PendingScanItem[]>([]);
  const [isSyncingPendingQueue, setIsSyncingPendingQueue] = useState(false);
  const [pendingQueueError, setPendingQueueError] = useState<string | null>(null);
  const [pendingQueueStatus, setPendingQueueStatus] = useState<string | null>(null);
  const captureStageRef = useRef<HTMLDivElement | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const existingTokens = getStoredAuthTokens();
    setTokens(existingTokens);
    setPendingQueue(loadPendingScanQueue());
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    const unsubscribe = window.desktopBridge.onGlobalCaptureHotkey((payload) => {
      setCapturedScreen(payload.capture);
      setSelectionRect(null);
      setRegionCaptureDataUrl(null);
      setOcrText("");
      setOcrError(null);
      setOcrStatus(null);
      setCaptureError(null);
      setStatus(
        `Global capture hotkey (${payload.shortcut}) triggered at ${new Date(
          payload.triggeredAt
        ).toLocaleTimeString()}.`
      );
    });

    return unsubscribe;
  }, []);

  const isAuthenticated = useMemo(() => tokens !== null, [tokens]);
  const findings = useMemo(() => buildFindingsFromText(ocrText), [ocrText]);
  const filteredFindings = useMemo(() => {
    if (severityFilter === "all") {
      return findings;
    }
    return findings.filter((finding) => finding.severity === severityFilter);
  }, [findings, severityFilter]);
  const activeFinding = useMemo(
    () => filteredFindings.find((finding) => finding.id === activeFindingId) ?? filteredFindings[0] ?? null,
    [activeFindingId, filteredFindings]
  );

  useEffect(() => {
    if (!activeFinding) {
      setActiveFindingId(null);
      return;
    }

    if (activeFindingId !== activeFinding.id) {
      setActiveFindingId(activeFinding.id);
    }
  }, [activeFinding, activeFindingId]);

  const syncPendingQueue = useCallback(
    async (origin: "manual" | "online" | "auth") => {
      if (isSyncingPendingQueue) {
        return;
      }

      if (!tokens?.accessToken) {
        if (origin === "manual") {
          setPendingQueueError("AUTH_REQUIRED");
        }
        return;
      }

      const queuedScans = loadPendingScanQueue();
      setPendingQueue(queuedScans);

      if (queuedScans.length === 0) {
        if (origin === "manual") {
          setPendingQueueStatus("No queued scans to sync.");
          setPendingQueueError(null);
        }
        return;
      }

      if (!window.navigator.onLine) {
        if (origin === "manual") {
          setPendingQueueError("OFFLINE_QUEUE_SYNC_UNAVAILABLE");
        }
        return;
      }

      setIsSyncingPendingQueue(true);
      setPendingQueueError(null);
      let syncedCount = 0;

      for (const queuedScan of queuedScans) {
        try {
          if (queuedScan.kind === "ocr") {
            await submitDesktopOcrContractSource(
              {
                title: queuedScan.title,
                content: queuedScan.content
              },
              tokens.accessToken
            );
          } else {
            await submitClipboardContractSource(
              {
                title: queuedScan.title,
                content: queuedScan.content
              },
              tokens.accessToken
            );
          }

          const remainingQueue = removePendingScanById(queuedScan.id);
          setPendingQueue(remainingQueue);
          syncedCount += 1;
        } catch (syncError) {
          const syncErrorCode = toErrorCode(syncError);
          const updatedQueue = updatePendingScanAttempt(queuedScan.id, syncErrorCode);
          setPendingQueue(updatedQueue);
          setPendingQueueError(syncErrorCode);

          if (isLikelyOfflineFailure(syncErrorCode) || syncErrorCode === "HTTP_401") {
            break;
          }
        }
      }

      if (syncedCount > 0) {
        setPendingQueueStatus(`Synced ${syncedCount} queued scan${syncedCount === 1 ? "" : "s"}.`);
      } else if (origin === "manual") {
        setPendingQueueStatus("No queued scans were synced.");
      }

      setIsSyncingPendingQueue(false);
    },
    [isSyncingPendingQueue, tokens]
  );

  useEffect(() => {
    const handleOnline = () => {
      void syncPendingQueue("online");
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [syncPendingQueue]);

  useEffect(() => {
    if (!tokens?.accessToken || pendingQueue.length === 0 || !window.navigator.onLine) {
      return;
    }

    void syncPendingQueue("auth");
  }, [pendingQueue.length, syncPendingQueue, tokens?.accessToken]);

  function queuePendingScan(
    scan: {
      kind: "ocr" | "clipboard";
      title: string;
      content: string;
    },
    statusMessage: string
  ) {
    const nextQueue = enqueuePendingScan(scan);
    setPendingQueue(nextQueue);
    setPendingQueueError(null);
    setPendingQueueStatus(statusMessage);
  }

  function formatFileSize(sizeInBytes: number) {
    if (sizeInBytes < 1024) {
      return `${sizeInBytes} B`;
    }

    if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    }

    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("EMAIL_AND_PASSWORD_REQUIRED");
      return;
    }

    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    try {
      const response = await loginWithPassword(email.trim(), password);
      const nextTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      };

      setStoredAuthTokens(nextTokens);
      setTokens(nextTokens);
      setPassword("");
      setStatus("Desktop session authenticated against backend auth endpoints.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "LOGIN_FAILED");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    if (!tokens) {
      return;
    }

    setError(null);
    setStatus(null);
    setIsLoggingOut(true);

    try {
      await logoutWithRefreshToken(tokens.refreshToken);
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "LOGOUT_FAILED");
    } finally {
      clearStoredAuthTokens();
      setTokens(null);
      setIsLoggingOut(false);
      setStatus("Cleared desktop auth session.");
    }
  }

  async function handleImportContractFiles() {
    setImportError(null);
    setIsImportingFiles(true);

    try {
      const selectedFiles = await window.desktopBridge.pickContractFiles();
      setImportedFiles(selectedFiles);
    } catch (pickError) {
      setImportError(pickError instanceof Error ? pickError.message : "FILE_IMPORT_FAILED");
    } finally {
      setIsImportingFiles(false);
    }
  }

  function toCaptureCoordinates(clientX: number, clientY: number) {
    if (!capturedScreen || !captureStageRef.current) {
      return null;
    }

    const bounds = captureStageRef.current.getBoundingClientRect();
    const normalizedX = (clientX - bounds.left) / bounds.width;
    const normalizedY = (clientY - bounds.top) / bounds.height;

    const x = Math.min(capturedScreen.width, Math.max(0, normalizedX * capturedScreen.width));
    const y = Math.min(capturedScreen.height, Math.max(0, normalizedY * capturedScreen.height));

    return { x, y };
  }

  async function handleCapturePrimaryScreen() {
    setCaptureError(null);
    setIsCapturingScreen(true);

    try {
      const screenshot = await window.desktopBridge.capturePrimaryScreen();
      setCapturedScreen(screenshot);
      setSelectionRect(null);
      setRegionCaptureDataUrl(null);
      setOcrText("");
      setOcrError(null);
      setOcrStatus(null);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : "SCREEN_CAPTURE_FAILED");
    } finally {
      setIsCapturingScreen(false);
    }
  }

  async function handleFinalizeRegionCapture() {
    if (!capturedScreen || !selectionRect) {
      setCaptureError("CAPTURE_REGION_REQUIRED");
      return;
    }

    const image = new Image();
    const imageLoaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("SCREENSHOT_IMAGE_LOAD_FAILED"));
    });
    image.src = capturedScreen.dataUrl;

    try {
      await imageLoaded;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(selectionRect.width));
      canvas.height = Math.max(1, Math.round(selectionRect.height));

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
      }

      context.drawImage(
        image,
        selectionRect.x,
        selectionRect.y,
        selectionRect.width,
        selectionRect.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      setRegionCaptureDataUrl(canvas.toDataURL("image/png"));
      setCaptureError(null);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : "SCREEN_REGION_CAPTURE_FAILED");
    }
  }

  async function handleRunOcrPipeline() {
    if (!tokens?.accessToken) {
      setOcrError("AUTH_REQUIRED");
      setOcrStatus(null);
      return;
    }

    if (!regionCaptureDataUrl) {
      setOcrError("CAPTURE_REGION_REQUIRED");
      setOcrStatus(null);
      return;
    }

    setIsRunningOcr(true);
    setOcrProgress(0);
    setOcrError(null);
    setOcrStatus(null);

    try {
      const extractedText = await extractTextFromCapturedImage(regionCaptureDataUrl, setOcrProgress);
      if (!extractedText.trim()) {
        throw new Error("OCR_TEXT_EMPTY");
      }

      setOcrText(extractedText);
      setSeverityFilter("all");
      const submissionTitle = `Screen capture ${new Date().toISOString()}`;
      if (!window.navigator.onLine) {
        queuePendingScan(
          {
            kind: "ocr",
            title: submissionTitle,
            content: extractedText
          },
          "Queued OCR scan for sync when connection is restored."
        );
        setOcrStatus("OCR complete. Submission queued for automatic sync when back online.");
        return;
      }

      try {
        const submission = await submitDesktopOcrContractSource(
          {
            title: submissionTitle,
            content: extractedText
          },
          tokens.accessToken
        );

        setOcrStatus(
          `OCR complete. Submitted contract ${submission.contractId} and queued version ${submission.contractVersionId}.`
        );
      } catch (submissionError) {
        const submissionErrorCode = toErrorCode(submissionError);
        if (isLikelyOfflineFailure(submissionErrorCode)) {
          queuePendingScan(
            {
              kind: "ocr",
              title: submissionTitle,
              content: extractedText
            },
            "Queued OCR scan after network failure. It will sync when online."
          );
          setOcrStatus("OCR complete. Submission queued because network is unavailable.");
          return;
        }

        throw submissionError;
      }
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "OCR_PIPELINE_FAILED");
    } finally {
      setIsRunningOcr(false);
      setOcrProgress(null);
    }
  }

  function navigateEvidence(direction: "prev" | "next") {
    if (filteredFindings.length === 0) {
      return;
    }

    const currentIndex = activeFinding
      ? filteredFindings.findIndex((finding) => finding.id === activeFinding.id)
      : 0;
    const baseIndex = currentIndex < 0 ? 0 : currentIndex;
    const delta = direction === "next" ? 1 : -1;
    const nextIndex = (baseIndex + delta + filteredFindings.length) % filteredFindings.length;

    setActiveFindingId(filteredFindings[nextIndex]?.id ?? null);
  }

  async function handleQuickClipboardReview() {
    if (!tokens?.accessToken) {
      setClipboardError("AUTH_REQUIRED");
      setClipboardStatus(null);
      return;
    }

    setIsSubmittingClipboard(true);
    setClipboardError(null);
    setClipboardStatus(null);

    try {
      const clipboardText = (await window.desktopBridge.readClipboardText()).trim();
      if (!clipboardText) {
        throw new Error("CLIPBOARD_TEXT_EMPTY");
      }

      setOcrText(clipboardText);
      setSeverityFilter("all");
      const submissionTitle = `Clipboard capture ${new Date().toISOString()}`;
      if (!window.navigator.onLine) {
        queuePendingScan(
          {
            kind: "clipboard",
            title: submissionTitle,
            content: clipboardText
          },
          "Queued clipboard scan for sync when connection is restored."
        );
        setClipboardStatus("Clipboard scan queued for automatic sync when back online.");
        return;
      }

      try {
        const submission = await submitClipboardContractSource(
          {
            title: submissionTitle,
            content: clipboardText
          },
          tokens.accessToken
        );

        setClipboardStatus(
          `Submitted clipboard review as contract ${submission.contractId} (version ${submission.contractVersionId}).`
        );
      } catch (submissionError) {
        const submissionErrorCode = toErrorCode(submissionError);
        if (isLikelyOfflineFailure(submissionErrorCode)) {
          queuePendingScan(
            {
              kind: "clipboard",
              title: submissionTitle,
              content: clipboardText
            },
            "Queued clipboard scan after network failure. It will sync when online."
          );
          setClipboardStatus("Clipboard scan queued because network is unavailable.");
          return;
        }

        throw submissionError;
      }
    } catch (error) {
      setClipboardError(error instanceof Error ? error.message : "CLIPBOARD_REVIEW_FAILED");
    } finally {
      setIsSubmittingClipboard(false);
    }
  }

  const activeEvidenceWindow = activeFinding
    ? {
        before: ocrText.slice(Math.max(0, activeFinding.startOffset - 120), activeFinding.startOffset),
        highlighted: ocrText.slice(activeFinding.startOffset, activeFinding.endOffset),
        after: ocrText.slice(activeFinding.endOffset, Math.min(ocrText.length, activeFinding.endOffset + 120))
      }
    : null;

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Desktop Scaffold</p>
        <h1>Legal Tech Companion</h1>
        <p className="subtitle">
          Electron + React + TypeScript foundation for desktop contract review workflows.
        </p>
      </header>

      <section className="app-card">
        <h2>Bridge Status</h2>
        <p>Platform: {window.desktopBridge.platform}</p>
        <p>Electron: {window.desktopBridge.electronVersion}</p>
      </section>

      <section className="app-card auth-card">
        <h2>Desktop Auth</h2>
        {isInitializing ? <p>Loading saved session...</p> : null}
        {error ? <p className="message message-error">{error}</p> : null}
        {status ? <p className="message message-success">{status}</p> : null}

        {!isInitializing && !isAuthenticated ? (
          <div className="auth-form">
            <label className="field">
              Email
              <input
                autoComplete="email"
                disabled={isSubmitting}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label className="field">
              Password
              <input
                autoComplete="current-password"
                disabled={isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <button disabled={isSubmitting} onClick={() => void handleLogin()} type="button">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </div>
        ) : null}

        {!isInitializing && isAuthenticated && tokens ? (
          <div className="auth-form">
            <p>Access token: {formatTokenPreview(tokens.accessToken)}</p>
            <p>Refresh token: {formatTokenPreview(tokens.refreshToken)}</p>
            <button disabled={isLoggingOut} onClick={() => void handleLogout()} type="button">
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="app-card importer-card">
        <div className="importer-header">
          <h2>Local Contract Importer</h2>
          <button disabled={isImportingFiles} onClick={() => void handleImportContractFiles()} type="button">
            {isImportingFiles ? "Importing..." : "Import Files"}
          </button>
        </div>
        {importError ? <p className="message message-error">{importError}</p> : null}
        <p>{importedFiles.length > 0 ? `${importedFiles.length} file(s) selected` : "No files imported yet."}</p>

        {importedFiles.length > 0 ? (
          <ul className="import-list">
            {importedFiles.map((file) => (
              <li className="import-item" key={`${file.path}:${file.size}`}>
                <p className="import-file-name">{file.name}</p>
                <p className="import-meta">
                  {file.kind.toUpperCase()} · {file.mimeType} · {formatFileSize(file.size)}
                </p>
                {file.kind === "txt" && file.textPreview ? (
                  <pre className="import-preview">{file.textPreview}</pre>
                ) : null}
                {file.kind === "image" ? (
                  <img
                    alt={file.name}
                    className="import-image-preview"
                    src={`data:${file.mimeType};base64,${file.base64Content}`}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="app-card capture-card">
        <div className="importer-header">
          <h2>Screen Region Capture</h2>
          <button disabled={isCapturingScreen} onClick={() => void handleCapturePrimaryScreen()} type="button">
            {isCapturingScreen ? "Capturing..." : "Capture Screen"}
          </button>
        </div>
        {captureError ? <p className="message message-error">{captureError}</p> : null}
        <p className="meta-row">
          Global shortcut: Cmd/Ctrl+Shift+R captures the primary screen from any app.
        </p>
        {capturedScreen ? <p>Captured {capturedScreen.name}. Drag on image to select a region.</p> : null}

        {capturedScreen ? (
          <>
            <div
              className="capture-stage"
              onMouseDown={(event) => {
                const coordinates = toCaptureCoordinates(event.clientX, event.clientY);
                if (!coordinates) {
                  return;
                }

                selectionStartRef.current = coordinates;
                setSelectionRect({
                  x: coordinates.x,
                  y: coordinates.y,
                  width: 0,
                  height: 0
                });
              }}
              onMouseMove={(event) => {
                const start = selectionStartRef.current;
                if (!start) {
                  return;
                }

                const current = toCaptureCoordinates(event.clientX, event.clientY);
                if (!current) {
                  return;
                }

                setSelectionRect({
                  x: Math.min(start.x, current.x),
                  y: Math.min(start.y, current.y),
                  width: Math.abs(current.x - start.x),
                  height: Math.abs(current.y - start.y)
                });
              }}
              onMouseUp={() => {
                selectionStartRef.current = null;
              }}
              onMouseLeave={() => {
                selectionStartRef.current = null;
              }}
              ref={captureStageRef}
            >
              <img
                alt="Full screen capture"
                className="capture-image"
                src={capturedScreen.dataUrl}
              />
              {selectionRect ? (
                <div
                  className="capture-selection"
                  style={{
                    left: `${(selectionRect.x / capturedScreen.width) * 100}%`,
                    top: `${(selectionRect.y / capturedScreen.height) * 100}%`,
                    width: `${(selectionRect.width / capturedScreen.width) * 100}%`,
                    height: `${(selectionRect.height / capturedScreen.height) * 100}%`
                  }}
                />
              ) : null}
            </div>
            <button
              disabled={!selectionRect || selectionRect.width < 4 || selectionRect.height < 4}
              onClick={() => void handleFinalizeRegionCapture()}
              type="button"
            >
              Save Region Capture
            </button>
          </>
        ) : null}

        {regionCaptureDataUrl ? (
          <>
            <img
              alt="Selected region capture"
              className="capture-region-preview"
              src={regionCaptureDataUrl}
            />
            <button
              disabled={isRunningOcr || !isAuthenticated}
              onClick={() => void handleRunOcrPipeline()}
              type="button"
            >
              {isRunningOcr
                ? `Running OCR${ocrProgress !== null ? ` (${ocrProgress}%)` : ""}...`
                : "Run OCR + Submit for Review"}
            </button>
            {ocrError ? <p className="message message-error">{ocrError}</p> : null}
            {ocrStatus ? <p className="message message-success">{ocrStatus}</p> : null}
            {ocrText ? <pre className="import-preview">{ocrText}</pre> : null}
          </>
        ) : null}
      </section>

      <section className="app-card">
        <div className="importer-header">
          <h2>Offline Sync Queue</h2>
          <button
            disabled={isSyncingPendingQueue || !isAuthenticated}
            onClick={() => void syncPendingQueue("manual")}
            type="button"
          >
            {isSyncingPendingQueue ? "Syncing..." : "Sync Pending Scans"}
          </button>
        </div>
        <p>
          Pending scans: {pendingQueue.length} {pendingQueue.length === 1 ? "item" : "items"}
        </p>
        {pendingQueueError ? <p className="message message-error">{pendingQueueError}</p> : null}
        {pendingQueueStatus ? <p className="message message-success">{pendingQueueStatus}</p> : null}
        {pendingQueue.length > 0 ? (
          <ul className="import-list">
            {pendingQueue.map((item) => (
              <li className="import-item" key={item.id}>
                <p className="import-file-name">{item.title}</p>
                <p className="import-meta">
                  {item.kind.toUpperCase()} · attempts {item.attempts} · created{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                {item.lastError ? <p className="message message-error">{item.lastError}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No queued scans.</p>
        )}
      </section>

      <section className="app-card findings-card">
        <div className="importer-header">
          <h2>Findings Panel</h2>
          <button
            disabled={isSubmittingClipboard || !isAuthenticated}
            onClick={() => void handleQuickClipboardReview()}
            type="button"
          >
            {isSubmittingClipboard ? "Starting..." : "Review Clipboard Text"}
          </button>
        </div>
        {clipboardError ? <p className="message message-error">{clipboardError}</p> : null}
        {clipboardStatus ? <p className="message message-success">{clipboardStatus}</p> : null}
        <div className="finding-filter-row">
          {(["all", "critical", "high", "medium", "low"] as const).map((filterValue) => (
            <button
              className={`filter-chip ${severityFilter === filterValue ? "filter-chip-active" : ""}`}
              key={filterValue}
              onClick={() => setSeverityFilter(filterValue)}
              type="button"
            >
              {filterValue}
            </button>
          ))}
        </div>

        {filteredFindings.length > 0 ? (
          <div className="findings-layout">
            <ul className="findings-list">
              {filteredFindings.map((finding) => (
                <li
                  className={`finding-item finding-item-${finding.severity} ${activeFinding?.id === finding.id ? "finding-item-active" : ""}`}
                  key={finding.id}
                  onClick={() => setActiveFindingId(finding.id)}
                >
                  <p className="finding-title">{finding.title}</p>
                  <p className="finding-meta">
                    {finding.severity.toUpperCase()} · offset {finding.startOffset}-{finding.endOffset}
                  </p>
                  <p className="finding-detail">{finding.rationale}</p>
                </li>
              ))}
            </ul>

            {activeFinding && activeEvidenceWindow ? (
              <aside className="evidence-panel">
                <div className="evidence-nav">
                  <button onClick={() => navigateEvidence("prev")} type="button">
                    Previous Evidence
                  </button>
                  <button onClick={() => navigateEvidence("next")} type="button">
                    Next Evidence
                  </button>
                </div>
                <p className="finding-meta">
                  Evidence for {activeFinding.title} ({activeFinding.severity.toUpperCase()})
                </p>
                <p className="evidence-text">
                  {activeEvidenceWindow.before}
                  <mark>{activeEvidenceWindow.highlighted}</mark>
                  {activeEvidenceWindow.after}
                </p>
              </aside>
            ) : null}
          </div>
        ) : (
          <p>No findings yet. Run OCR to generate evidence-backed findings.</p>
        )}
      </section>
    </main>
  );
}
