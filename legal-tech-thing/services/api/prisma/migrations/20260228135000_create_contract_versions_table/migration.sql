CREATE TABLE IF NOT EXISTS contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  source_checksum TEXT NOT NULL,
  storage_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contract_versions_contract_id_source_checksum_key UNIQUE (contract_id, source_checksum)
);

CREATE INDEX IF NOT EXISTS contract_versions_contract_id_idx ON contract_versions(contract_id);
