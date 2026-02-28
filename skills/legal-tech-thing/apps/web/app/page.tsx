"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchDashboardContracts,
  type DashboardContract
} from "../src/contracts/api";
import { apiClient } from "../src/lib/api-client";

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

export default function HomePage() {
  const [contracts, setContracts] = useState<DashboardContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);

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

  async function uploadSelectedFile() {
    if (!droppedFile || !title.trim()) {
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const mimeType = inferMimeType(droppedFile);
      const checksum = await computeSha256(droppedFile);

      const createContractResponse = (await apiClient.request("/contracts", {
        method: "POST",
        body: {
          title: title.trim(),
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
            fileName: droppedFile.name,
            mimeType,
            contentLength: droppedFile.size
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
        body: droppedFile
      });

      if (!uploadResponse.ok) {
        throw new Error(`UPLOAD_FAILED_${uploadResponse.status}`);
      }

      await apiClient.request(`/contracts/${contractId}/ingest`, {
        method: "POST",
        body: {
          objectUri: uploadInstructionResponse.objectUri,
          objectKey: uploadInstructionResponse.objectKey,
          mimeType,
          contentLength: droppedFile.size,
          checksum
        }
      });

      setDroppedFile(null);
      setTitle("");
      await loadContracts();
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : "UPLOAD_FAILED");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main>
      <h1>Contracts Dashboard</h1>
      <p>
        <Link href="/login">Login</Link> | <Link href="/register">Register</Link> |
        <Link href="/logout"> Logout</Link>
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
