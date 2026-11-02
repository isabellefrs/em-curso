CREATE TABLE IF NOT EXISTS sessoes_admin (
  hash TEXT PRIMARY KEY,
  usuario TEXT NOT NULL,
  expira INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessoes_admin_expira ON sessoes_admin(expira);