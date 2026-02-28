"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  fetchContractDetail,
  type ContractClause,
  type ContractDetailResponse
} from "../../../src/contracts/detail-api";
import {
  createFindingFeedback,
  fetchContractFindings,
  updateFindingStatus,
  type ContractFinding,
  type FeedbackSeverity
} from "../../../src/findings/api";
import {
  fetchMyPolicyProfile,
  type PolicyProvider
} from "../../../src/policy/api";
import {
  compareReviewRuns,
  createReviewRun,
  fetchReviewRun,
  subscribeToReviewRunEvents,
  type CompareReviewRunsResponse,
  type ReviewRunProgress
} from "../../../src/reviews/api";

const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
const providers: PolicyProvider[] = ["OPENAI", "ANTHROPIC", "GEMINI", "OLLAMA"];
const feedbackSeverityOptions: FeedbackSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info"
];

function toConfidencePercentage(confidence: string) {
  const value = Number(confidence);

  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.round(value * 100)}%`;
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const contractId = params.id;
  const [detail, setDetail] = useState<ContractDetailResponse | null>(null);
  const [findings, setFindings] = useState<ContractFinding[]>([]);
  const [selectedClause, setSelectedClause] = useState<ContractClause | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [updatingFindingId, setUpdatingFindingId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<PolicyProvider>("OPENAI");
  const [isComparisonEnabled, setIsComparisonEnabled] = useState(false);
  const [comparisonProvider, setComparisonProvider] = useState<PolicyProvider>("ANTHROPIC");
  const [profileOptions, setProfileOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [isLaunchingReview, setIsLaunchingReview] = useState(false);
  const [reviewLaunchError, setReviewLaunchError] = useState<string | null>(null);
  const [reviewLaunchStatus, setReviewLaunchStatus] = useState<string | null>(null);
  const [trackedReviewIdInput, setTrackedReviewIdInput] = useState("");
  const [trackedReviewRunId, setTrackedReviewRunId] = useState("");
  const [liveProgress, setLiveProgress] = useState<ReviewRunProgress | null>(null);
  const [comparisonResult, setComparisonResult] = useState<CompareReviewRunsResponse | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [feedbackDrafts, setFeedbackDrafts] = useState<
    Record<string, { rationale: string; correctedSeverity: FeedbackSeverity | "" }>
  >({});
  const [submittingFeedbackId, setSubmittingFeedbackId] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);

  const groupedFindings = useMemo(() => {
    const grouped = new Map<string, ContractFinding[]>();

    for (const finding of findings) {
      const existing = grouped.get(finding.severity) ?? [];
      existing.push(finding);
      grouped.set(finding.severity, existing);
    }

    return severityOrder
      .map((severity) => ({
        severity,
        items: grouped.get(severity) ?? []
      }))
      .filter((group) => group.items.length > 0);
  }, [findings]);

  useEffect(() => {
    async function loadDetail() {
      setError(null);
      setIsLoading(true);

      try {
        const [detailResponse, findingsResponse, profileResponse] = await Promise.all([
          fetchContractDetail(contractId),
          fetchContractFindings(contractId),
          fetchMyPolicyProfile().catch(() => null)
        ]);

        setDetail(detailResponse);
        setFindings(findingsResponse);
        setProfileOptions(
          profileResponse
            ? [
                {
                  id: profileResponse.id,
                  label: `Default profile (${profileResponse.defaultProvider})`
                }
              ]
            : []
        );
        setSelectedProfileId(profileResponse?.id ?? "");
        setSelectedProvider(profileResponse?.defaultProvider ?? "OPENAI");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "DETAIL_LOAD_FAILED");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDetail();
  }, [contractId]);

  useEffect(() => {
    if (comparisonProvider !== selectedProvider) {
      return;
    }

    const fallback = providers.find((provider) => provider !== selectedProvider);
    if (fallback) {
      setComparisonProvider(fallback);
    }
  }, [comparisonProvider, selectedProvider]);

  useEffect(() => {
    if (!trackedReviewRunId) {
      return;
    }

    let isMounted = true;

    setRealtimeError(null);

    void fetchReviewRun(trackedReviewRunId)
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setLiveProgress({
          id: response.reviewRun.id,
          status: response.reviewRun.status,
          progressPercent: response.reviewRun.progressPercent,
          provider: response.reviewRun.providerMetadata.provider,
          providerModel: response.reviewRun.providerMetadata.model,
          startedAt: response.reviewRun.startedAt,
          finishedAt: response.reviewRun.finishedAt,
          errorCode: response.reviewRun.errorCode,
          errorMessage: response.reviewRun.errorMessage,
          updatedAt: response.reviewRun.updatedAt
        });
      })
      .catch((initialError) => {
        if (isMounted) {
          setRealtimeError(
            initialError instanceof Error
              ? initialError.message
              : "REVIEW_PROGRESS_LOAD_FAILED"
          );
        }
      });

    const unsubscribe = subscribeToReviewRunEvents({
      reviewRunId: trackedReviewRunId,
      onProgress: (event) => {
        setLiveProgress(event);
      },
      onError: (message) => {
        setRealtimeError(message);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [trackedReviewRunId]);

  async function handleUpdateStatus(
    findingId: string,
    status: "accepted" | "dismissed"
  ) {
    setStatusUpdateError(null);
    setUpdatingFindingId(findingId);

    try {
      const updated = await updateFindingStatus(findingId, status);
      setFindings((current) =>
        current.map((finding) => (finding.id === updated.id ? updated : finding))
      );
    } catch (updateError) {
      setStatusUpdateError(
        updateError instanceof Error ? updateError.message : "STATUS_UPDATE_FAILED"
      );
    } finally {
      setUpdatingFindingId(null);
    }
  }

  async function handleLaunchReview() {
    if (!detail?.latestVersion?.id) {
      return;
    }

    setReviewLaunchError(null);
    setReviewLaunchStatus(null);
    setComparisonResult(null);
    setIsLaunchingReview(true);

    try {
      if (isComparisonEnabled) {
        if (comparisonProvider === selectedProvider) {
          throw new Error("COMPARISON_PROVIDER_MUST_DIFFER");
        }

        const comparison = await compareReviewRuns({
          contractVersionId: detail.latestVersion.id,
          profileId: selectedProfileId || undefined,
          primaryProvider: selectedProvider,
          comparisonProvider
        });

        setComparisonResult(comparison);
        setReviewLaunchStatus(
          `Comparison complete: ${comparison.counts.primary} vs ${comparison.counts.comparison}`
        );
        return;
      }

      const response = await createReviewRun({
        contractVersionId: detail.latestVersion.id,
        profileId: selectedProfileId || undefined,
        provider: selectedProvider
      });
      setReviewLaunchStatus(`Review queued: ${response.reviewRun.id}`);
      setTrackedReviewIdInput(response.reviewRun.id);
      setTrackedReviewRunId(response.reviewRun.id);
    } catch (launchError) {
      setReviewLaunchError(
        launchError instanceof Error ? launchError.message : "REVIEW_LAUNCH_FAILED"
      );
    } finally {
      setIsLaunchingReview(false);
    }
  }

  function handleTrackReviewRun() {
    const reviewRunId = trackedReviewIdInput.trim();

    if (!reviewRunId) {
      setRealtimeError("REVIEW_RUN_ID_REQUIRED");
      return;
    }

    setLiveProgress(null);
    setRealtimeError(null);
    setTrackedReviewRunId(reviewRunId);
  }

  async function handleSubmitFeedback(finding: ContractFinding) {
    const draft = feedbackDrafts[finding.id] ?? {
      rationale: "",
      correctedSeverity: "" as const
    };
    const rationale = draft.rationale.trim();

    if (!rationale) {
      setFeedbackError("FEEDBACK_RATIONALE_REQUIRED");
      return;
    }

    setFeedbackError(null);
    setFeedbackStatus(null);
    setSubmittingFeedbackId(finding.id);

    const action =
      finding.status === "ACCEPTED"
        ? "accepted"
        : finding.status === "DISMISSED"
          ? "dismissed"
          : "edited";

    try {
      const updatedFinding = await createFindingFeedback(finding.id, {
        action,
        rationale,
        correctedSeverity: draft.correctedSeverity || undefined
      });
      setFindings((current) =>
        current.map((item) => (item.id === updatedFinding.id ? updatedFinding : item))
      );
      setFeedbackDrafts((current) => ({
        ...current,
        [finding.id]: {
          rationale: "",
          correctedSeverity: ""
        }
      }));
      setFeedbackStatus(`Feedback submitted for finding ${finding.id}.`);
    } catch (submitError) {
      setFeedbackError(
        submitError instanceof Error ? submitError.message : "FINDING_FEEDBACK_FAILED"
      );
    } finally {
      setSubmittingFeedbackId(null);
    }
  }

  return (
    <main>
      <p>
        <Link href="/">Back to dashboard</Link>
      </p>
      {isLoading ? <p>Loading contract detail...</p> : null}
      {error ? <p>{error}</p> : null}
      {detail ? (
        <>
          <h1>{detail.contract.title}</h1>
          <p>
            Status: {detail.contract.status} | Source: {detail.contract.sourceType}
          </p>
          <p>
            Latest version: {detail.latestVersion?.id ?? "-"} | Clauses: {detail.clauses.length}
          </p>

          <section>
            <h2>Launch Review Run</h2>
            {detail.latestVersion ? (
              <>
                <p>
                  <label>
                    Provider{" "}
                    <select
                      disabled={isLaunchingReview}
                      onChange={(event) =>
                        setSelectedProvider(event.target.value as PolicyProvider)
                      }
                      value={selectedProvider}
                    >
                      {providers.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                  </label>
                </p>
                <p>
                  <label>
                    <input
                      checked={isComparisonEnabled}
                      disabled={isLaunchingReview}
                      onChange={(event) => setIsComparisonEnabled(event.target.checked)}
                      type="checkbox"
                    />{" "}
                    Compare against second provider
                  </label>
                </p>
                {isComparisonEnabled ? (
                  <p>
                    <label>
                      Comparison provider{" "}
                      <select
                        disabled={isLaunchingReview}
                        onChange={(event) =>
                          setComparisonProvider(event.target.value as PolicyProvider)
                        }
                        value={comparisonProvider}
                      >
                        {providers
                          .filter((provider) => provider !== selectedProvider)
                          .map((provider) => (
                            <option key={provider} value={provider}>
                              {provider}
                            </option>
                          ))}
                      </select>
                    </label>
                  </p>
                ) : null}
                <p>
                  <label>
                    Policy profile{" "}
                    <select
                      disabled={isLaunchingReview || profileOptions.length === 0}
                      onChange={(event) => setSelectedProfileId(event.target.value)}
                      value={selectedProfileId}
                    >
                      {profileOptions.length === 0 ? (
                        <option value="">Use server default profile</option>
                      ) : null}
                      {profileOptions.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </p>
                <p>
                  <button
                    disabled={isLaunchingReview}
                    onClick={() => void handleLaunchReview()}
                    type="button"
                  >
                    {isLaunchingReview
                      ? isComparisonEnabled
                        ? "Comparing..."
                        : "Launching..."
                      : isComparisonEnabled
                        ? "Run provider comparison"
                        : "Launch review"}
                  </button>
                </p>
                <p>
                  <label>
                    Track review run ID{" "}
                    <input
                      onChange={(event) => setTrackedReviewIdInput(event.target.value)}
                      value={trackedReviewIdInput}
                    />
                  </label>{" "}
                  <button onClick={handleTrackReviewRun} type="button">
                    Track live progress
                  </button>{" "}
                  <button
                    onClick={() => {
                      setTrackedReviewRunId("");
                      setTrackedReviewIdInput("");
                      setLiveProgress(null);
                      setRealtimeError(null);
                    }}
                    type="button"
                  >
                    Stop tracking
                  </button>
                </p>
                {reviewLaunchError ? <p>{reviewLaunchError}</p> : null}
                {reviewLaunchStatus ? <p>{reviewLaunchStatus}</p> : null}
                {comparisonResult ? (
                  <article>
                    <p>
                      Provider comparison: {comparisonResult.providers.primary} vs{" "}
                      {comparisonResult.providers.comparison}
                    </p>
                    <p>
                      Findings - primary: {comparisonResult.counts.primary}, comparison:{" "}
                      {comparisonResult.counts.comparison}
                    </p>
                    <p>
                      Introduced: {comparisonResult.counts.introduced} | Resolved:{" "}
                      {comparisonResult.counts.resolved} | Changed:{" "}
                      {comparisonResult.counts.changed} | Unchanged:{" "}
                      {comparisonResult.counts.unchanged}
                    </p>
                    {comparisonResult.deltas.introduced.length > 0 ? (
                      <p>
                        Introduced titles:{" "}
                        {comparisonResult.deltas.introduced
                          .map((item) => item.title)
                          .join(", ")}
                      </p>
                    ) : null}
                    {comparisonResult.deltas.resolved.length > 0 ? (
                      <p>
                        Resolved titles:{" "}
                        {comparisonResult.deltas.resolved
                          .map((item) => item.title)
                          .join(", ")}
                      </p>
                    ) : null}
                  </article>
                ) : null}
                {realtimeError ? <p>{realtimeError}</p> : null}
                {trackedReviewRunId ? <p>Live stream: {trackedReviewRunId}</p> : null}
                {liveProgress ? (
                  <article>
                    <p>
                      Status: {liveProgress.status} | Provider: {liveProgress.provider} (
                      {liveProgress.providerModel})
                    </p>
                    <p>
                      Progress: {Math.round(liveProgress.progressPercent)}%{" "}
                      <progress max={100} value={liveProgress.progressPercent} />
                    </p>
                    {liveProgress.errorCode || liveProgress.errorMessage ? (
                      <p>
                        Failure: {liveProgress.errorCode ?? "UNKNOWN"}{" "}
                        {liveProgress.errorMessage ? `(${liveProgress.errorMessage})` : ""}
                      </p>
                    ) : null}
                    <p>
                      Updated:{" "}
                      <time dateTime={liveProgress.updatedAt}>
                        {new Date(liveProgress.updatedAt).toLocaleString()}
                      </time>
                    </p>
                  </article>
                ) : null}
              </>
            ) : (
              <p>No contract version is available yet for review launch.</p>
            )}
          </section>

          <section>
            <h2>Findings by Severity</h2>
            {statusUpdateError ? <p>{statusUpdateError}</p> : null}
            {feedbackError ? <p>{feedbackError}</p> : null}
            {feedbackStatus ? <p>{feedbackStatus}</p> : null}
            {groupedFindings.length === 0 ? <p>No findings yet.</p> : null}
            {groupedFindings.map((group) => (
              <article key={group.severity}>
                <h3>
                  {group.severity} ({group.items.length})
                </h3>
                <ul>
                  {group.items.map((finding) => (
                    <li key={finding.id}>
                      {(() => {
                        const draft = feedbackDrafts[finding.id] ?? {
                          rationale: "",
                          correctedSeverity: "" as const
                        };

                        return (
                          <>
                            <strong>{finding.title}</strong> [{finding.status}] <br />
                            <span>Confidence: {toConfidencePercentage(finding.confidence)}</span>
                            <p>{finding.description}</p>
                            <blockquote>{finding.evidenceSpan.excerpt}</blockquote>
                            <p>
                              <button
                                disabled={updatingFindingId === finding.id}
                                onClick={() => void handleUpdateStatus(finding.id, "accepted")}
                                type="button"
                              >
                                Accept
                              </button>{" "}
                              <button
                                disabled={updatingFindingId === finding.id}
                                onClick={() => void handleUpdateStatus(finding.id, "dismissed")}
                                type="button"
                              >
                                Dismiss
                              </button>
                            </p>
                            <p>
                              <label>
                                Feedback rationale
                                <textarea
                                  disabled={submittingFeedbackId === finding.id}
                                  onChange={(event) =>
                                    setFeedbackDrafts((current) => ({
                                      ...current,
                                      [finding.id]: {
                                        ...draft,
                                        rationale: event.target.value
                                      }
                                    }))
                                  }
                                  value={draft.rationale}
                                />
                              </label>
                            </p>
                            <p>
                              <label>
                                Corrected severity
                                <select
                                  disabled={submittingFeedbackId === finding.id}
                                  onChange={(event) =>
                                    setFeedbackDrafts((current) => ({
                                      ...current,
                                      [finding.id]: {
                                        ...draft,
                                        correctedSeverity: event.target.value as
                                          | FeedbackSeverity
                                          | ""
                                      }
                                    }))
                                  }
                                  value={draft.correctedSeverity}
                                >
                                  <option value="">No correction</option>
                                  {feedbackSeverityOptions.map((severity) => (
                                    <option key={severity} value={severity}>
                                      {severity}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </p>
                            <p>
                              <button
                                disabled={submittingFeedbackId === finding.id}
                                onClick={() => void handleSubmitFeedback(finding)}
                                type="button"
                              >
                                {submittingFeedbackId === finding.id
                                  ? "Submitting feedback..."
                                  : "Submit feedback"}
                              </button>
                            </p>
                          </>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section>
            <h2>Clauses</h2>
            <ul>
              {detail.clauses.map((clause) => (
                <li key={clause.id}>
                  <button onClick={() => setSelectedClause(clause)} type="button">
                    [{clause.startOffset}-{clause.endOffset}] {clause.type}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Selected Clause</h2>
            {selectedClause ? (
              <article>
                <p>
                  Offsets: {selectedClause.startOffset}-{selectedClause.endOffset}
                </p>
                <p>
                  Parser: {selectedClause.sourceParser} (confidence {selectedClause.parserConfidence})
                </p>
                <pre>{selectedClause.normalizedText}</pre>
              </article>
            ) : (
              <p>Select a clause offset to inspect its extracted text.</p>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
