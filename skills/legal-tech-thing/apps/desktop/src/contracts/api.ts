import { API_BASE_URL } from "../config";

const SOURCE_TYPE = "DESKTOP_SCREEN";
const SOURCE_MIME_TYPE = "text/plain; charset=utf-8";

interface CreateContractResponse {
  contract: {
    id: string;
    title: string;
    sourceType: string;
  };
}

interface UploadInstructionsResponse {
  uploadUrl: string;
  objectUri: string;
  objectKey: string;
}

interface IngestResponse {
  queueJobId: string | number;
  contractVersion: {
    id: string;
  };
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  accessToken: string;
}

export interface SubmitDesktopOcrContractInput {
  title: string;
  content: string;
}

export interface SubmitDesktopOcrContractResult {
  contractId: string;
  contractVersionId: string;
  queueJobId: string | number;
}

async function parseErrorCode(response: Response) {
  const fallbackCode = `HTTP_${response.status}`;
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return typeof payload?.error === "string" ? payload.error : fallbackCode;
}

async function requestWithAccessToken<T>(path: string, options: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      ...(options.body !== undefined ? { "content-type": "application/json" } : {})
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
  });

  if (!response.ok) {
    throw new Error(await parseErrorCode(response));
  }

  return response.json() as Promise<T>;
}

function toSafeFileName(title: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized ? `${normalized}.txt` : "desktop-ocr-capture.txt";
}

async function sha256Hex(content: string) {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hashBytes = Array.from(new Uint8Array(digest));
  return hashBytes.map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function uploadExtractedContent(uploadUrl: string, content: string) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": SOURCE_MIME_TYPE
    },
    body: content
  });

  if (!response.ok) {
    throw new Error(`UPLOAD_FAILED_${response.status}`);
  }
}

export async function submitDesktopOcrContractSource(
  input: SubmitDesktopOcrContractInput,
  accessToken: string
): Promise<SubmitDesktopOcrContractResult> {
  const content = input.content.trim();
  const title = input.title.trim();

  if (!content) {
    throw new Error("EMPTY_OCR_CONTENT");
  }

  if (!title) {
    throw new Error("EMPTY_CONTRACT_TITLE");
  }

  const bytes = new TextEncoder().encode(content);
  const contentLength = bytes.byteLength;
  const checksum = await sha256Hex(content);

  const createContract = await requestWithAccessToken<CreateContractResponse>("/contracts", {
    method: "POST",
    accessToken,
    body: {
      title,
      sourceType: SOURCE_TYPE
    }
  });

  const uploadInstructions = await requestWithAccessToken<UploadInstructionsResponse>(
    `/contracts/${createContract.contract.id}/upload-url`,
    {
      method: "POST",
      accessToken,
      body: {
        fileName: toSafeFileName(title),
        mimeType: SOURCE_MIME_TYPE,
        contentLength
      }
    }
  );

  await uploadExtractedContent(uploadInstructions.uploadUrl, content);

  const ingest = await requestWithAccessToken<IngestResponse>(
    `/contracts/${createContract.contract.id}/ingest`,
    {
      method: "POST",
      accessToken,
      body: {
        objectUri: uploadInstructions.objectUri,
        objectKey: uploadInstructions.objectKey,
        mimeType: SOURCE_MIME_TYPE,
        contentLength,
        checksum
      }
    }
  );

  return {
    contractId: createContract.contract.id,
    contractVersionId: ingest.contractVersion.id,
    queueJobId: ingest.queueJobId
  };
}
