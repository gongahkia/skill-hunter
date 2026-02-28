"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  fetchDashboardContracts,
  type DashboardContract
} from "../src/contracts/api";

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export default function HomePage() {
  const [contracts, setContracts] = useState<DashboardContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContracts() {
      setError(null);
      setIsLoading(true);

      try {
        const data = await fetchDashboardContracts();
        setContracts(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "LOAD_FAILED");
      } finally {
        setIsLoading(false);
      }
    }

    void loadContracts();
  }, []);

  return (
    <main>
      <h1>Contracts Dashboard</h1>
      <p>
        <Link href="/login">Login</Link> | <Link href="/register">Register</Link> |
        <Link href="/logout"> Logout</Link>
      </p>
      {isLoading ? <p>Loading contracts...</p> : null}
      {error ? <p>{error}</p> : null}
      {!isLoading && !error ? (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Source</th>
              <th>Status</th>
              <th>Last Review</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract.id}>
                <td>{contract.title}</td>
                <td>{contract.sourceType}</td>
                <td>{contract.status}</td>
                <td>{formatDate(contract.lastReviewAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
