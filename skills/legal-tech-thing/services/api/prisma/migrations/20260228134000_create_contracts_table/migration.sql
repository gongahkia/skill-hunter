DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_source_type') THEN
    CREATE TYPE contract_source_type AS ENUM ('UPLOAD', 'WEB', 'EXTENSION_DOM', 'DESKTOP_SCREEN', 'CLIPBOARD');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_processing_status') THEN
    CREATE TYPE contract_processing_status AS ENUM ('CREATED', 'UPLOADING', 'QUEUED', 'INGESTING', 'READY', 'FAILED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type contract_source_type NOT NULL,
  status contract_processing_status NOT NULL DEFAULT 'CREATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_owner_id_idx ON contracts(owner_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx ON contracts(status);
