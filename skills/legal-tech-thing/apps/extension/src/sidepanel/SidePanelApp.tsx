import { useCallback, useEffect, useMemo, useState } from "react";

import { loginWithPassword, logoutWithRefreshToken } from "../auth/api";
import {
  clearStoredAuthTokens,
  getStoredAuthTokens,
  setStoredAuthTokens,
  type StoredAuthTokens
} from "../auth/storage";
import { submitExtractedContractSource } from "../contracts/api";
import {
  applyPolicyModePreset,
  fetchMyPolicyProfile,
  inferPolicyMode,
  type ExtensionPolicyMode
} from "../policy/api";

function formatTokenPreview(token: string) {
  if (token.length <= 16) {
    return token;
  }

  return `${token.slice(0, 8)}...${token.slice(-8)}`;
}

const GET_ACTIVE_SCAN_STATE_MESSAGE_TYPE = "extension.scanState.getActiveTab.v1";
const HIGHLIGHT_ACTIVE_TAB_MESSAGE_TYPE = "extension.highlightFinding.activeTab.v1";
const CLEAR_ACTIVE_TAB_HIGHLIGHT_MESSAGE_TYPE = "extension.highlightFinding.activeTab.clear.v1";

type ScanStatus = "idle" | "scanning" | "issues" | "clear";
type FindingSeverity = "high" | "medium" | "low";

interface DetectionSnapshot {
  isContractLike: boolean;
  confidence: number;
  score: number;
  matchedPhrases: string[];
}

interface ExtractionSnapshot {
  url: string;
  title: string;
  extractedText: string;
  extractedCharacters: number;
  truncated: boolean;
}

interface TermsLinksSnapshot {
  links: Array<{ url: string; label: string; relevanceScore: number }>;
}

interface PreAcceptInterceptSnapshot {
  eventType: "click" | "submit";
  controlType: "checkbox" | "button" | "link";
  controlLabel: string;
  interceptedAt: string;
}

interface ActiveScanState {
  tabId: number | null;
  detection: DetectionSnapshot | null;
  extraction: ExtractionSnapshot | null;
  termsLinks: TermsLinksSnapshot | null;
  preAcceptIntercept: PreAcceptInterceptSnapshot | null;
}

interface ScanStateResponse {
  ok?: boolean;
  error?: string;
  scanState?: ActiveScanState;
}

interface ScanFinding {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  offsetStart?: number;
  offsetEnd?: number;
}

function findPhraseOffsetRange(extractedText: string, phrases: string[]) {
  const normalizedText = extractedText.toLowerCase();

  for (const phrase of phrases) {
    const normalizedPhrase = phrase.trim().toLowerCase();
    if (!normalizedPhrase) {
      continue;
    }

    const start = normalizedText.indexOf(normalizedPhrase);
    if (start >= 0) {
      return {
        offsetStart: start,
        offsetEnd: start + normalizedPhrase.length
      };
    }
  }

  return null;
}

function formatScanStatus(status: ScanStatus) {
  switch (status) {
    case "scanning":
      return "Scanning active tab";
    case "issues":
      return "Issues detected";
    case "clear":
      return "No high-risk signals";
    case "idle":
    default:
      return "Idle";
  }
}

function toRelativeTimeLabel(isoDate: string) {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return "unknown time";
  }

  const deltaMs = Date.now() - timestamp;
  const deltaSeconds = Math.max(0, Math.floor(deltaMs / 1000));
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }
  const deltaHours = Math.floor(deltaMinutes / 60);
  return `${deltaHours}h ago`;
}

function deriveScanStatus(scanState: ActiveScanState | null, isLoading: boolean): ScanStatus {
  if (isLoading && scanState === null) {
    return "scanning";
  }
  if (!scanState?.detection && !scanState?.extraction && !scanState?.termsLinks) {
    return "idle";
  }

  const hasMissingTermsLinksIssue =
    scanState?.detection?.isContractLike === true &&
    (!scanState.termsLinks || scanState.termsLinks.links.length === 0);
  const hasRecentAcceptIntercept = scanState?.preAcceptIntercept !== null;

  if (hasMissingTermsLinksIssue || hasRecentAcceptIntercept) {
    return "issues";
  }

  return "clear";
}

function deriveTopFindings(scanState: ActiveScanState | null) {
  if (!scanState) {
    return [] as ScanFinding[];
  }

  const findings: ScanFinding[] = [];
  const phraseOffsetRange =
    scanState.extraction && scanState.detection?.matchedPhrases?.length
      ? findPhraseOffsetRange(scanState.extraction.extractedText, scanState.detection.matchedPhrases)
      : null;

  if (scanState.detection?.isContractLike) {
    findings.push({
      id: "contract-detected",
      severity: "medium",
      title: "Contract-like page detected",
      detail: `Heuristic confidence ${Math.round(scanState.detection.confidence * 100)}% (score ${scanState.detection.score}).`,
      offsetStart: phraseOffsetRange?.offsetStart,
      offsetEnd: phraseOffsetRange?.offsetEnd
    });
  }

  if (scanState.detection?.isContractLike && (!scanState.termsLinks || scanState.termsLinks.links.length === 0)) {
    findings.push({
      id: "missing-terms-links",
      severity: "high",
      title: "No nearby legal links found",
      detail: "No Terms/Policy URL was found near consent controls on the active tab."
    });
  }

  if (scanState.termsLinks && scanState.termsLinks.links.length > 0) {
    findings.push({
      id: "terms-links-found",
      severity: "low",
      title: `Found ${scanState.termsLinks.links.length} legal link${scanState.termsLinks.links.length === 1 ? "" : "s"}`,
      detail: `Top link: ${scanState.termsLinks.links[0]?.label || scanState.termsLinks.links[0]?.url || "N/A"}.`
    });
  }

  if (scanState.preAcceptIntercept) {
    findings.push({
      id: "accept-action-intercepted",
      severity: "high",
      title: "Acceptance action intercepted",
      detail: `${scanState.preAcceptIntercept.eventType} on ${scanState.preAcceptIntercept.controlType} control "${scanState.preAcceptIntercept.controlLabel || "unknown"}" ${toRelativeTimeLabel(scanState.preAcceptIntercept.interceptedAt)}.`
    });
  }

  if (scanState.extraction?.truncated) {
    findings.push({
      id: "extraction-truncated",
      severity: "medium",
      title: "Extraction truncated",
      detail: `Visible text capture stopped at ${scanState.extraction.extractedCharacters.toLocaleString()} characters.`
    });
  }

  const severityRank: Record<FindingSeverity, number> = {
    high: 3,
    medium: 2,
    low: 1
  };

  return findings.sort((left, right) => severityRank[right.severity] - severityRank[left.severity]).slice(0, 4);
}

export function SidePanelApp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tokens, setTokens] = useState<StoredAuthTokens | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ActiveScanState | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanLoading, setIsScanLoading] = useState(true);
  const [isRefreshingScan, setIsRefreshingScan] = useState(false);
  const [isSubmittingContract, setIsSubmittingContract] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [activeHighlightFindingId, setActiveHighlightFindingId] = useState<string | null>(null);
  const [policyMode, setPolicyMode] = useState<ExtensionPolicyMode>("personal");
  const [isUpdatingPolicyMode, setIsUpdatingPolicyMode] = useState(false);
  const [policyModeError, setPolicyModeError] = useState<string | null>(null);
  const [policyModeStatus, setPolicyModeStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadStoredSession() {
      try {
        const existingTokens = await getStoredAuthTokens();
        setTokens(existingTokens);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "AUTH_INIT_FAILED");
      } finally {
        setIsInitializing(false);
      }
    }

    void loadStoredSession();
  }, []);

  useEffect(() => {
    if (!tokens?.accessToken) {
      setPolicyMode("personal");
      setPolicyModeError(null);
      setPolicyModeStatus(null);
      return;
    }

    let isMounted = true;

    void fetchMyPolicyProfile(tokens.accessToken)
      .then((profile) => {
        if (!isMounted) {
          return;
        }

        setPolicyMode(inferPolicyMode(profile));
        setPolicyModeError(null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setPolicyModeError(
          error instanceof Error ? error.message : "POLICY_PROFILE_LOAD_FAILED"
        );
      });

    return () => {
      isMounted = false;
    };
  }, [tokens?.accessToken]);

  const isAuthenticated = useMemo(() => tokens !== null, [tokens]);
  const scanStatus = useMemo(() => deriveScanStatus(scanState, isScanLoading), [scanState, isScanLoading]);
  const topFindings = useMemo(() => deriveTopFindings(scanState), [scanState]);

  const clearFindingHighlight = useCallback(async () => {
    await chrome.runtime.sendMessage({
      type: CLEAR_ACTIVE_TAB_HIGHLIGHT_MESSAGE_TYPE
    });
    setActiveHighlightFindingId(null);
  }, []);

  const refreshScanState = useCallback(async (origin: "initial" | "manual" | "poll") => {
    if (origin === "initial") {
      setIsScanLoading(true);
    }
    if (origin === "manual") {
      setIsRefreshingScan(true);
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: GET_ACTIVE_SCAN_STATE_MESSAGE_TYPE
      })) as ScanStateResponse;

      if (!response?.ok) {
        throw new Error(response?.error || "SCAN_STATE_FETCH_FAILED");
      }

      setScanState(response.scanState ?? null);
      setScanError(null);
    } catch (refreshError) {
      setScanError(refreshError instanceof Error ? refreshError.message : "SCAN_STATE_FETCH_FAILED");
    } finally {
      setIsScanLoading(false);
      if (origin === "manual") {
        setIsRefreshingScan(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshScanState("initial");

    const intervalId = window.setInterval(() => {
      void refreshScanState("poll");
    }, 4_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshScanState]);

  useEffect(() => {
    if (!activeHighlightFindingId) {
      return;
    }

    const activeFindingStillVisible = topFindings.some((finding) => finding.id === activeHighlightFindingId);
    if (!activeFindingStillVisible) {
      void clearFindingHighlight();
    }
  }, [activeHighlightFindingId, clearFindingHighlight, topFindings]);

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
      await setStoredAuthTokens(nextTokens);
      setTokens(nextTokens);
      setPassword("");
      setStatus("Authenticated and stored tokens in chrome.storage.local.");
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
      await clearStoredAuthTokens();
      setTokens(null);
      setStatus("Cleared auth tokens from chrome.storage.local.");
      setIsLoggingOut(false);
    }
  }

  async function handleSwitchPolicyMode(nextMode: ExtensionPolicyMode) {
    if (!tokens?.accessToken) {
      setPolicyModeError("AUTH_REQUIRED");
      return;
    }

    setIsUpdatingPolicyMode(true);
    setPolicyModeError(null);
    setPolicyModeStatus(null);

    try {
      const profile = await applyPolicyModePreset(tokens.accessToken, nextMode);
      const resolvedMode = inferPolicyMode(profile);
      setPolicyMode(resolvedMode);
      setPolicyModeStatus(
        `Policy mode updated to ${resolvedMode === "strict" ? "strict" : "personal"}.`
      );
    } catch (error) {
      setPolicyModeError(
        error instanceof Error ? error.message : "POLICY_MODE_UPDATE_FAILED"
      );
    } finally {
      setIsUpdatingPolicyMode(false);
    }
  }

  async function handleSubmitExtractedContent() {
    if (!tokens?.accessToken) {
      setSubmitError("AUTH_REQUIRED");
      setSubmitStatus(null);
      return;
    }

    const extractedText = scanState?.extraction?.extractedText?.trim();
    if (!extractedText) {
      setSubmitError("NO_EXTRACTED_CONTENT");
      setSubmitStatus(null);
      return;
    }

    const contractTitle =
      scanState?.extraction?.title?.trim() ||
      (scanState?.detection?.isContractLike
        ? "Contract capture from active tab"
        : "Page capture from active tab");

    setIsSubmittingContract(true);
    setSubmitError(null);
    setSubmitStatus(null);

    try {
      const submission = await submitExtractedContractSource(
        {
          title: contractTitle,
          content: extractedText
        },
        tokens.accessToken
      );

      setSubmitStatus(
        `Submitted contract ${submission.contractId} and queued version ${submission.contractVersionId}.`
      );
    } catch (submitContractError) {
      setSubmitError(
        submitContractError instanceof Error ? submitContractError.message : "CONTRACT_SUBMIT_FAILED"
      );
    } finally {
      setIsSubmittingContract(false);
    }
  }

  async function handleHighlightFinding(finding: ScanFinding) {
    if (finding.offsetStart === undefined || finding.offsetEnd === undefined) {
      setHighlightError("FINDING_OFFSETS_UNAVAILABLE");
      return;
    }

    if (activeHighlightFindingId === finding.id) {
      try {
        await clearFindingHighlight();
        setHighlightError(null);
      } catch (clearError) {
        setHighlightError(clearError instanceof Error ? clearError.message : "HIGHLIGHT_CLEAR_FAILED");
      }
      return;
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: HIGHLIGHT_ACTIVE_TAB_MESSAGE_TYPE,
        payload: {
          findingId: finding.id,
          offsetStart: finding.offsetStart,
          offsetEnd: finding.offsetEnd
        }
      })) as { ok?: boolean; error?: string; highlighted?: boolean };

      if (!response?.ok || response.highlighted !== true) {
        throw new Error(response?.error || "FINDING_HIGHLIGHT_FAILED");
      }

      setActiveHighlightFindingId(finding.id);
      setHighlightError(null);
    } catch (highlightFindingError) {
      setHighlightError(
        highlightFindingError instanceof Error
          ? highlightFindingError.message
          : "FINDING_HIGHLIGHT_FAILED"
      );
    }
  }

  return (
    <main className="panel">
      <header>
        <h1>Legal Tech Companion</h1>
        <p>Track contract risk signals on the active tab and manage extension auth.</p>
      </header>

      {isInitializing ? <p>Loading local auth session...</p> : null}
      {error ? <p className="message message-error">{error}</p> : null}
      {status ? <p className="message message-success">{status}</p> : null}

      <section className="panel-section">
        <div className="section-header">
          <h2>Active Tab Scan</h2>
          <button
            className="button-secondary"
            disabled={isRefreshingScan}
            onClick={() => void refreshScanState("manual")}
            type="button"
          >
            {isRefreshingScan ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <p className={`scan-status scan-status-${scanStatus}`}>{formatScanStatus(scanStatus)}</p>
        {scanError ? <p className="message message-error">{scanError}</p> : null}

        <p className="meta-row">
          Active tab: {scanState?.tabId !== null && scanState?.tabId !== undefined ? `#${scanState.tabId}` : "N/A"}
        </p>
        <p className="meta-row">
          Extracted text:{" "}
          {scanState?.extraction
            ? `${scanState.extraction.extractedCharacters.toLocaleString()} chars`
            : "No scan payload yet"}
        </p>
        <button
          disabled={isSubmittingContract || !isAuthenticated || !scanState?.extraction?.extractedText}
          onClick={() => void handleSubmitExtractedContent()}
          type="button"
        >
          {isSubmittingContract ? "Submitting..." : "Submit as Contract Source"}
        </button>
        {submitError ? <p className="message message-error">{submitError}</p> : null}
        {submitStatus ? <p className="message message-success">{submitStatus}</p> : null}

        <h3 className="findings-heading">Top Findings</h3>
        {highlightError ? <p className="message message-error">{highlightError}</p> : null}
        {topFindings.length > 0 ? (
          <ul className="findings-list">
            {topFindings.map((finding) => (
              <li
                className={`finding-item finding-item-${finding.severity} ${activeHighlightFindingId === finding.id ? "finding-item-active" : ""}`}
                key={finding.id}
              >
                <div className="finding-row">
                  <p className="finding-title">{finding.title}</p>
                  {finding.offsetStart !== undefined && finding.offsetEnd !== undefined ? (
                    <button
                      className="finding-highlight-button"
                      onClick={() => void handleHighlightFinding(finding)}
                      type="button"
                    >
                      {activeHighlightFindingId === finding.id ? "Clear highlight" : "Highlight"}
                    </button>
                  ) : null}
                </div>
                <p className="finding-detail">{finding.detail}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-findings">No findings for the active tab yet.</p>
        )}
      </section>

      <section className="panel-section">
        <h2>Review Mode</h2>
        <p className="meta-row">
          Quick switch policy profile between personal and strict review presets.
        </p>
        <div className="mode-switch-row">
          <button
            className={policyMode === "personal" ? "mode-button-active" : "button-secondary"}
            disabled={!isAuthenticated || isUpdatingPolicyMode}
            onClick={() => void handleSwitchPolicyMode("personal")}
            type="button"
          >
            Personal
          </button>
          <button
            className={policyMode === "strict" ? "mode-button-active" : "button-secondary"}
            disabled={!isAuthenticated || isUpdatingPolicyMode}
            onClick={() => void handleSwitchPolicyMode("strict")}
            type="button"
          >
            Strict
          </button>
        </div>
        <p className="meta-row">
          Active mode: {policyMode === "strict" ? "Strict" : "Personal"}
        </p>
        {policyModeError ? <p className="message message-error">{policyModeError}</p> : null}
        {policyModeStatus ? <p className="message message-success">{policyModeStatus}</p> : null}
      </section>

      {!isInitializing && !isAuthenticated ? (
        <section className="panel-section">
          <h2>Login</h2>
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
        </section>
      ) : null}

      {!isInitializing && isAuthenticated && tokens ? (
        <section className="panel-section">
          <h2>Session Active</h2>
          <p>Access token: {formatTokenPreview(tokens.accessToken)}</p>
          <p>Refresh token: {formatTokenPreview(tokens.refreshToken)}</p>
          <button disabled={isLoggingOut} onClick={() => void handleLogout()} type="button">
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
