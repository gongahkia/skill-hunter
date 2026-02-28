ALTER TABLE policy_profiles
  ADD COLUMN IF NOT EXISTS default_provider llm_provider NOT NULL DEFAULT 'OPENAI';
