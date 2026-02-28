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
  fetchContractFindings,
  updateFindingStatus,
  type ContractFinding
} from "../../../src/findings/api";

const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

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
        const [detailResponse, findingsResponse] = await Promise.all([
          fetchContractDetail(contractId),
          fetchContractFindings(contractId)
        ]);

        setDetail(detailResponse);
        setFindings(findingsResponse);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "DETAIL_LOAD_FAILED");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDetail();
  }, [contractId]);

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
            <h2>Findings by Severity</h2>
            {statusUpdateError ? <p>{statusUpdateError}</p> : null}
            {groupedFindings.length === 0 ? <p>No findings yet.</p> : null}
            {groupedFindings.map((group) => (
              <article key={group.severity}>
                <h3>
                  {group.severity} ({group.items.length})
                </h3>
                <ul>
                  {group.items.map((finding) => (
                    <li key={finding.id}>
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
