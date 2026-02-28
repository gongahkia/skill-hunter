export type ContractSourceType =
  | "UPLOAD"
  | "WEB"
  | "EXTENSION_DOM"
  | "DESKTOP_SCREEN"
  | "CLIPBOARD";

export type LlmProvider = "OPENAI" | "ANTHROPIC" | "GEMINI" | "OLLAMA";

export type FindingStatus = "open" | "accepted" | "dismissed" | "needs-edit";
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  accessTokenTtl: string;
}

export interface LegalTechClientConfig {
  baseUrl: string;
  fetch?: typeof fetch;
  getAccessToken?: () => string | null | Promise<string | null>;
  onUnauthorized?: (error: ApiError) => void | Promise<void>;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  withAuth?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
}

export class ApiError extends Error {
  readonly status: number;

  readonly code: string;

  readonly details: unknown;

  constructor(status: number, code: string, details: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function appendQueryParams(path: string, query: RequestOptions["query"]) {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    params.set(key, String(value));
  }

  const serialized = params.toString();
  if (!serialized) {
    return path;
  }

  return `${path}?${serialized}`;
}

export class LegalTechClient {
  private readonly baseUrl: string;

  private readonly fetchImpl: typeof fetch;

  private readonly getAccessToken?: () => string | null | Promise<string | null>;

  private readonly onUnauthorized?: (error: ApiError) => void | Promise<void>;

  constructor(config: LegalTechClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/g, "");
    this.fetchImpl = config.fetch ?? fetch;
    this.getAccessToken = config.getAccessToken;
    this.onUnauthorized = config.onUnauthorized;
  }

  readonly auth = {
    register: async (payload: { email: string; password: string }) => {
      return this.request<{
        user: { id: string; email: string; createdAt: string };
      }>("/auth/register", {
        method: "POST",
        withAuth: false,
        body: payload
      });
    },
    login: async (payload: { email: string; password: string }) => {
      return this.request<AuthTokens>("/auth/login", {
        method: "POST",
        withAuth: false,
        body: payload
      });
    },
    refresh: async (refreshToken: string) => {
      return this.request<AuthTokens>("/auth/refresh", {
        method: "POST",
        withAuth: false,
        body: { refreshToken }
      });
    },
    logout: async (refreshToken: string) => {
      await this.request<void>("/auth/logout", {
        method: "POST",
        withAuth: false,
        body: { refreshToken }
      });
    }
  };

  readonly contracts = {
    list: async () => {
      return this.request<{
        items: Array<{
          id: string;
          title: string;
          sourceType: string;
          status: string;
          createdAt: string;
          updatedAt: string;
          lastReviewAt: string | null;
        }>;
      }>("/contracts");
    },
    get: async (contractId: string) => {
      return this.request<{
        contract: {
          id: string;
          title: string;
          sourceType: string;
          status: string;
          createdAt: string;
          updatedAt: string;
        };
        latestVersion: {
          id: string;
          createdAt: string;
          clauses: Array<{
            id: string;
            type: string;
            normalizedText: string;
            startOffset: number;
            endOffset: number;
            sourceParser: string | null;
            parserConfidence: number | null;
          }>;
        } | null;
        clauses: Array<{
          id: string;
          type: string;
          normalizedText: string;
          startOffset: number;
          endOffset: number;
          sourceParser: string | null;
          parserConfidence: number | null;
        }>;
      }>(`/contracts/${contractId}`);
    },
    create: async (payload: { title: string; sourceType: ContractSourceType }) => {
      return this.request<{
        contract: {
          id: string;
          ownerId: string;
          title: string;
          sourceType: ContractSourceType;
          status: string;
          createdAt: string;
          updatedAt: string;
        };
        uploadInstructions: {
          nextEndpoint: string;
          method: "POST";
          requiredFields: string[];
        };
      }>("/contracts", {
        method: "POST",
        body: payload
      });
    },
    createUploadUrl: async (
      contractId: string,
      payload: { fileName: string; mimeType: string; contentLength: number }
    ) => {
      return this.request<{
        uploadUrl: string;
        objectUri: string;
        objectKey: string;
        expiresInSeconds: number;
        expectedContentLength: number;
        expectedContentType: string;
      }>(`/contracts/${contractId}/upload-url`, {
        method: "POST",
        body: payload
      });
    },
    ingest: async (
      contractId: string,
      payload: {
        objectUri: string;
        objectKey: string;
        mimeType: string;
        contentLength: number;
        checksum: string;
      }
    ) => {
      return this.request<{
        queued: true;
        queueJobId: string | number;
        contractVersion: {
          id: string;
          contractId: string;
          checksum: string;
          storageUri: string;
          createdAt: string;
        };
      }>(`/contracts/${contractId}/ingest`, {
        method: "POST",
        body: payload
      });
    },
    uploadToSignedUrl: async (uploadUrl: string, body: BodyInit, mimeType: string) => {
      const response = await this.fetchImpl(uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": mimeType
        },
        body
      });

      if (!response.ok) {
        throw new ApiError(response.status, `UPLOAD_HTTP_${response.status}`, await response.text());
      }
    },
    listFindings: async (
      contractId: string,
      query: {
        cursor?: string;
        limit?: number;
        severity?: FindingSeverity;
        status?: FindingStatus;
      } = {}
    ) => {
      return this.request<{
        items: Array<{
          id: string;
          title: string;
          severity: string;
          status: string;
          summary: string;
          confidence: number | null;
          evidenceSpan: {
            id: string;
            startOffset: number;
            endOffset: number;
            excerpt: string;
            pageNumber: number | null;
          } | null;
          createdAt: string;
          updatedAt: string;
        }>;
        pagination: {
          nextCursor: string | null;
        };
      }>(`/contracts/${contractId}/findings`, {
        query
      });
    }
  };

  readonly reviews = {
    create: async (payload: {
      contractVersionId: string;
      profileId?: string;
      provider?: LlmProvider;
      selectedAgents?: string[];
    }) => {
      return this.request<{
        reviewRun: {
          id: string;
          contractVersionId: string;
          profileId: string;
          provider: string;
          providerModel: string;
          status: string;
          createdAt: string;
        };
        queued: true;
        queueJobId: string | number;
      }>("/reviews", {
        method: "POST",
        body: payload
      });
    },
    get: async (reviewRunId: string) => {
      return this.request<{
        reviewRun: {
          id: string;
          contractVersionId: string;
          profileId: string;
          provider: string;
          providerModel: string;
          status: string;
          orchestrationMeta: Record<string, unknown>;
          startedAt: string | null;
          finishedAt: string | null;
          errorCode: string | null;
          errorMessage: string | null;
          createdAt: string;
          updatedAt: string;
          progressPercent: number;
          providerMetadata: {
            provider: string;
            model: string;
          };
        };
      }>(`/reviews/${reviewRunId}`);
    }
  };

  readonly findings = {
    updateStatus: async (findingId: string, status: FindingStatus) => {
      return this.request<{
        finding: unknown;
      }>(`/findings/${findingId}`, {
        method: "PATCH",
        body: { status }
      });
    },
    createFeedback: async (
      findingId: string,
      payload: {
        action?: "accepted" | "dismissed" | "edited";
        rationale: string;
        correctedSeverity?: FindingSeverity;
        correctedTitle?: string;
      }
    ) => {
      return this.request<{
        finding: unknown;
      }>(`/findings/${findingId}/feedback`, {
        method: "POST",
        body: payload
      });
    }
  };

  private async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const withAuth = options.withAuth ?? true;
    const requestPath = appendQueryParams(path, options.query);

    const headers: Record<string, string> = {
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {})
    };

    if (withAuth && this.getAccessToken) {
      const accessToken = await this.getAccessToken();
      if (accessToken) {
        headers.authorization = `Bearer ${accessToken}`;
      }
    }

    const response = await this.fetchImpl(`${this.baseUrl}${requestPath}`, {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const code =
        typeof (errorBody as { error?: unknown }).error === "string"
          ? ((errorBody as { error: string }).error ?? `HTTP_${response.status}`)
          : `HTTP_${response.status}`;
      const apiError = new ApiError(response.status, code, errorBody);

      if (response.status === 401 && this.onUnauthorized) {
        await this.onUnauthorized(apiError);
      }

      throw apiError;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
