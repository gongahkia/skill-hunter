CREATE TABLE IF NOT EXISTS policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES policy_profiles(id) ON DELETE CASCADE,
  clause_requirement clause_type,
  clause_selector TEXT NOT NULL,
  required_pattern TEXT,
  forbidden_pattern TEXT,
  allow_exception BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS policy_rules_profile_id_idx ON policy_rules(profile_id);
CREATE INDEX IF NOT EXISTS policy_rules_priority_idx ON policy_rules(priority);
