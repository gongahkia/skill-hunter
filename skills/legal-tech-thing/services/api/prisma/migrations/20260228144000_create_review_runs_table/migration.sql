DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_provider') THEN
    CREATE TYPE llm_provider AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI', 'OLLAMA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_run_status') THEN
    CREATE TYPE review_run_status AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS review_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version_id UUID NOT NULL REFERENCES contract_versions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES policy_profiles(id) ON DELETE CASCADE,
  provider llm_provider NOT NULL,
  provider_model TEXT NOT NULL,
  status review_run_status NOT NULL DEFAULT 'QUEUED',
  orchestration_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_runs_contract_version_id_idx ON review_runs(contract_version_id);
CREATE INDEX IF NOT EXISTS review_runs_profile_id_idx ON review_runs(profile_id);
CREATE INDEX IF NOT EXISTS review_runs_status_idx ON review_runs(status);
