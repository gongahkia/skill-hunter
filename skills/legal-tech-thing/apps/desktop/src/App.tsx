import { useEffect, useMemo, useRef, useState } from "react";

import { loginWithPassword, logoutWithRefreshToken } from "./auth/api";
import {
  clearStoredAuthTokens,
  getStoredAuthTokens,
  setStoredAuthTokens,
  type AuthTokens
} from "./auth/token-store";
import { submitDesktopOcrContractSource } from "./contracts/api";
import { extractTextFromCapturedImage } from "./ocr/pipeline";

function formatTokenPreview(token: string) {
  if (token.length <= 16) {
    return token;
  }

  return `${token.slice(0, 8)}...${token.slice(-8)}`;
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
  const captureStageRef = useRef<HTMLDivElement | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const existingTokens = getStoredAuthTokens();
    setTokens(existingTokens);
    setIsInitializing(false);
  }, []);

  const isAuthenticated = useMemo(() => tokens !== null, [tokens]);

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
      const submission = await submitDesktopOcrContractSource(
        {
          title: `Screen capture ${new Date().toISOString()}`,
          content: extractedText
        },
        tokens.accessToken
      );

      setOcrStatus(
        `OCR complete. Submitted contract ${submission.contractId} and queued version ${submission.contractVersionId}.`
      );
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "OCR_PIPELINE_FAILED");
    } finally {
      setIsRunningOcr(false);
      setOcrProgress(null);
    }
  }

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
    </main>
  );
}
