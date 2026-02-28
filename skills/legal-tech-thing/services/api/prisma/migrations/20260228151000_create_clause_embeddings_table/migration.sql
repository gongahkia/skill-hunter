CREATE TABLE IF NOT EXISTS clause_embeddings (
  clause_id UUID PRIMARY KEY REFERENCES clauses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  embedding vector NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clause_embeddings_vector_cosine_idx
  ON clause_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
