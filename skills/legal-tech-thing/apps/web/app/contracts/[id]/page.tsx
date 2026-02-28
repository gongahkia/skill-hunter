"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  fetchContractDetail,
  type ContractClause,
  type ContractDetailResponse
} from "../../../src/contracts/detail-api";

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const contractId = params.id;
  const [detail, setDetail] = useState<ContractDetailResponse | null>(null);
  const [selectedClause, setSelectedClause] = useState<ContractClause | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetail() {
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetchContractDetail(contractId);
        setDetail(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "DETAIL_LOAD_FAILED");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDetail();
  }, [contractId]);

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
