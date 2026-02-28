DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_action') THEN
    CREATE TYPE feedback_action AS ENUM ('ACCEPTED', 'DISMISSED', 'EDITED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS review_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  action feedback_action NOT NULL,
  rationale TEXT,
  corrected_title TEXT,
  corrected_severity finding_severity,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_feedback_finding_id_idx ON review_feedback(finding_id);
CREATE INDEX IF NOT EXISTS review_feedback_action_idx ON review_feedback(action);
