export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type CaseRecord = {
  id: string;
  name: string;
  matterNumber: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
};

export type EvidenceRecord = {
  id: string;
  caseId: string;
  title: string;
  sourceType: "document" | "email" | "chat" | "note" | "external";
  sourceRef: string;
  capturedAt: string;
  excerpt: string;
  chainOfCustody: string[];
  createdAt: string;
};

export type FindingRecord = {
  id: string;
  caseId: string;
  title: string;
  summary: string;
  severity: Severity;
  evidenceIds: string[];
  status: "open" | "accepted" | "dismissed";
  createdAt: string;
  updatedAt: string;
};

export type BundleRecord = {
  id: string;
  caseId: string;
  generatedAt: string;
  requestedBy: string;
  digest: string;
  signature: string;
  filePath: string;
  findingsCount: number;
  evidenceCount: number;
};

export type ExportArtifact = {
  schemaVersion: "1.0";
  generatedAt: string;
  case: CaseRecord;
  evidence: EvidenceRecord[];
  findings: FindingRecord[];
  manifest: {
    evidenceHashes: Array<{ id: string; hash: string }>;
    findingHashes: Array<{ id: string; hash: string }>;
    timelineHash: string;
    digest: string;
    signature: string;
  };
};

export type Store = {
  cases: CaseRecord[];
  evidence: EvidenceRecord[];
  findings: FindingRecord[];
  bundles: BundleRecord[];
};
