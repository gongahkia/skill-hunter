DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clause_type') THEN
    CREATE TYPE clause_type AS ENUM (
      'DEFINITIONS',
      'SCOPE',
      'PAYMENT',
      'TERM',
      'TERMINATION',
      'LIABILITY',
      'INDEMNITY',
      'IP',
      'CONFIDENTIALITY',
      'PRIVACY',
      'GOVERNING_LAW',
      'DISPUTE_RESOLUTION',
      'MISC',
      'UNKNOWN'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version_id UUID NOT NULL REFERENCES contract_versions(id) ON DELETE CASCADE,
  type clause_type NOT NULL DEFAULT 'UNKNOWN',
  normalized_text TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clauses_contract_version_id_idx ON clauses(contract_version_id);
CREATE INDEX IF NOT EXISTS clauses_type_idx ON clauses(type);
