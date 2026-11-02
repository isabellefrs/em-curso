CREATE TABLE IF NOT EXISTS feedback_ia (
  id TEXT PRIMARY KEY,
  avaliacao TEXT NOT NULL CHECK(avaliacao IN ('ajudou','melhorar')),
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_ia_criado_em ON feedback_ia(criado_em);
