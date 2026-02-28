DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finding_severity') THEN
    CREATE TYPE finding_severity AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finding_status') THEN
    CREATE TYPE finding_status AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED', 'NEEDS_EDIT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS evidence_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version_id UUID NOT NULL REFERENCES contract_versions(id) ON DELETE CASCADE,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  excerpt TEXT NOT NULL,
  page_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_spans_contract_version_id_idx ON evidence_spans(contract_version_id);

CREATE TABLE IF NOT EXISTS findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version_id UUID NOT NULL REFERENCES contract_versions(id) ON DELETE CASCADE,
  clause_id UUID REFERENCES clauses(id) ON DELETE SET NULL,
  evidence_span_id UUID NOT NULL REFERENCES evidence_spans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity finding_severity NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  status finding_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS findings_contract_version_id_idx ON findings(contract_version_id);
CREATE INDEX IF NOT EXISTS findings_clause_id_idx ON findings(clause_id);
CREATE INDEX IF NOT EXISTS findings_severity_idx ON findings(severity);
CREATE INDEX IF NOT EXISTS findings_status_idx ON findings(status);
