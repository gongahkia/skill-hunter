"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchDashboardContracts,
  type DashboardContract
} from "../src/contracts/api";
import { apiClient } from "../src/lib/api-client";
import {
  createBulkReviewRun,
  fetchBulkReviewProgress,
  type BulkReviewProgressResponse
} from "../src/reviews/api";

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function inferMimeType(file: File) {
  if (file.type) {
    return file.type;
  }

  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return "text/plain";
  }

  return "application/octet-stream";
}

async function computeSha256(file: File) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashBytes = Array.from(new Uint8Array(hashBuffer));

  return hashBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function inferContractTitle(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "").trim();
  return withoutExtension.length > 0 ? withoutExtension : "Bulk upload contract";
}

type BulkUploadItemState = {
  key: string;
  fileName: string;
  status: "pending" | "uploaded" | "failed";
  contractVersionId: string | null;
  error: string | null;
};

export default function HomePage() {
  const [contracts, setContracts] = useState<DashboardContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkUploadItems, setBulkUploadItems] = useState<BulkUploadItemState[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [activeBulkReviewId, setActiveBulkReviewId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkReviewProgressResponse | null>(null);

  const canUpload = useMemo(() => {
    return Boolean(droppedFile && title.trim().length > 0 && !isUploading);
  }, [droppedFile, title, isUploading]);

  const loadContracts = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    if (!activeBulkReviewId) {
      return;
    }

    let isCancelled = false;
    let timerId: number | null = null;

    const pollBulkProgress = async () => {
      try {
        const progress = await fetchBulkReviewProgress(activeBulkReviewId);
        if (isCancelled) {
          return;
        }

        setBulkProgress(progress);

        const completedCount =
          progress.summary.completed + progress.summary.failed + progress.summary.cancelled;
        if (completedCount >= progress.summary.total) {
          setBulkStatus(
            `Bulk review complete: ${progress.summary.completed} completed, ${progress.summary.failed} failed, ${progress.summary.cancelled} cancelled.`
          );
          setActiveBulkReviewId(null);
          await loadContracts();
          return;
        }
      } catch (pollError) {
        if (!isCancelled) {
          setBulkError(
            pollError instanceof Error ? pollError.message : "BULK_REVIEW_POLL_FAILED"
          );
          setActiveBulkReviewId(null);
        }
        return;
      }

      timerId = window.setTimeout(() => {
        void pollBulkProgress();
      }, 2_000);
    };

    void pollBulkProgress();

    return () => {
      isCancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [activeBulkReviewId, loadContracts]);

  async function createContractAndIngestFile(file: File, contractTitle: string) {
    const mimeType = inferMimeType(file);
    const checksum = await computeSha256(file);

    const createContractResponse = (await apiClient.request("/contracts", {
      method: "POST",
      body: {
        title: contractTitle,
        sourceType: "UPLOAD"
      }
    })) as {
      contract: {
        id: string;
      };
    };

    const contractId = createContractResponse.contract.id;
    const uploadInstructionResponse = (await apiClient.request(
      `/contracts/${contractId}/upload-url`,
      {
        method: "POST",
        body: {
          fileName: file.name,
          mimeType,
          contentLength: file.size
        }
      }
    )) as {
      uploadUrl: string;
      objectUri: string;
      objectKey: string;
    };

    const uploadResponse = await fetch(uploadInstructionResponse.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": mimeType
      },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error(`UPLOAD_FAILED_${uploadResponse.status}`);
    }

    const ingestResponse = (await apiClient.request(`/contracts/${contractId}/ingest`, {
      method: "POST",
      body: {
        objectUri: uploadInstructionResponse.objectUri,
        objectKey: uploadInstructionResponse.objectKey,
        mimeType,
        contentLength: file.size,
        checksum
      }
    })) as {
      contractVersion: {
        id: string;
      };
    };

    return {
      contractId,
      contractVersionId: ingestResponse.contractVersion.id
    };
  }

  async function uploadSelectedFile() {
    if (!droppedFile || !title.trim()) {
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      await createContractAndIngestFile(droppedFile, title.trim());

      setDroppedFile(null);
      setTitle("");
      await loadContracts();
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : "UPLOAD_FAILED");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleBulkUploadAndReviewLaunch() {
    if (bulkFiles.length === 0 || isBulkRunning) {
      return;
    }

    setIsBulkRunning(true);
    setBulkError(null);
    setBulkStatus(null);
    setBulkProgress(null);
    setActiveBulkReviewId(null);

    const filesWithKeys = bulkFiles.map((file, index) => ({
      file,
      key: `${file.name}:${index}`
    }));

    setBulkUploadItems(
      filesWithKeys.map((item) => ({
        key: item.key,
        fileName: item.file.name,
        status: "pending",
        contractVersionId: null,
        error: null
      }))
    );

    const contractVersionIds: string[] = [];

    for (const item of filesWithKeys) {
      try {
        const uploadResult = await createContractAndIngestFile(
          item.file,
          inferContractTitle(item.file.name)
        );
        contractVersionIds.push(uploadResult.contractVersionId);

        setBulkUploadItems((current) =>
          current.map((row) =>
            row.key === item.key
              ? {
                  ...row,
                  status: "uploaded",
                  contractVersionId: uploadResult.contractVersionId
                }
              : row
          )
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "BULK_UPLOAD_ITEM_FAILED";

        setBulkUploadItems((current) =>
          current.map((row) =>
            row.key === item.key
              ? {
                  ...row,
                  status: "failed",
                  error: errorMessage
                }
              : row
          )
        );
      }
    }

    if (contractVersionIds.length === 0) {
      setBulkError("BULK_UPLOAD_NO_VALID_CONTRACT_VERSIONS");
      setIsBulkRunning(false);
      return;
    }

    try {
      const bulkReview = await createBulkReviewRun({
        contractVersionIds
      });

      setActiveBulkReviewId(bulkReview.bulkReviewId);
      setBulkStatus(
        `Bulk review ${bulkReview.bulkReviewId} launched for ${bulkReview.queuedCount} contract version(s).`
      );
      await loadContracts();
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "BULK_REVIEW_LAUNCH_FAILED");
    } finally {
      setIsBulkRunning(false);
    }
  }

  return (
    <main>
      <h1>Contracts Dashboard</h1>
      <p>
        <Link href="/login">Login</Link> | <Link href="/register">Register</Link> |{" "}
        <Link href="/logout">Logout</Link> | <Link href="/policy">Policy</Link>
      </p>

      <section>
        <h2>Upload Contract</h2>
        <label>
          Contract title
          <input
            disabled={isUploading}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragActive(false);

            const file = event.dataTransfer.files?.[0];

            if (file) {
              setDroppedFile(file);
            }
          }}
          style={{
            border: "2px dashed #999",
            padding: "1rem",
            marginTop: "0.75rem",
            background: isDragActive ? "#f5f5f5" : "transparent"
          }}
        >
          {droppedFile ? (
            <p>
              Selected file: <strong>{droppedFile.name}</strong>
            </p>
          ) : (
            <p>Drag and drop PDF, DOCX, image, or text file here.</p>
          )}
        </div>
        <p>
          <button disabled={!canUpload} onClick={() => void uploadSelectedFile()}>
            {isUploading ? "Uploading..." : "Upload and ingest"}
          </button>
        </p>
        {uploadError ? <p>{uploadError}</p> : null}
      </section>

      <section>
        <h2>Bulk Upload + Review</h2>
        <p>Select multiple files to upload and launch one bulk review job.</p>
        <input
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            setBulkFiles(files);
          }}
          type="file"
        />
        <p>
          <button
            disabled={bulkFiles.length === 0 || isBulkRunning}
            onClick={() => void handleBulkUploadAndReviewLaunch()}
            type="button"
          >
            {isBulkRunning ? "Uploading and launching..." : "Launch bulk upload + review"}
          </button>
        </p>
        <p>
          Selected files: {bulkFiles.length}{" "}
          {bulkFiles.length === 1 ? "file" : "files"}
        </p>
        {bulkError ? <p>{bulkError}</p> : null}
        {bulkStatus ? <p>{bulkStatus}</p> : null}
        {activeBulkReviewId ? <p>Polling bulk review: {activeBulkReviewId}</p> : null}
        {bulkUploadItems.length > 0 ? (
          <ul>
            {bulkUploadItems.map((item) => (
              <li key={item.key}>
                {item.fileName} - {item.status}
                {item.contractVersionId ? ` (${item.contractVersionId})` : ""}
                {item.error ? ` [${item.error}]` : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {bulkProgress ? (
          <article>
            <p>
              Progress: queued {bulkProgress.summary.queued}, running{" "}
              {bulkProgress.summary.running}, completed{" "}
              {bulkProgress.summary.completed}, failed {bulkProgress.summary.failed},
              cancelled {bulkProgress.summary.cancelled}
            </p>
            <ul>
              {bulkProgress.items.map((item) => (
                <li key={`${item.contractVersionId}:${item.reviewRunId ?? "none"}`}>
                  {item.contractVersionId} - {item.status} ({Math.round(item.progressPercent)}%)
                </li>
              ))}
            </ul>
          </article>
        ) : null}
      </section>

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
                <td>
                  <Link href={`/contracts/${contract.id}`}>{contract.title}</Link>
                </td>
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
