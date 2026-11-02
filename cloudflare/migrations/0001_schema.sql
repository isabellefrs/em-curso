CREATE TABLE IF NOT EXISTS administradores (
      id INTEGER PRIMARY KEY, usuario TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessoes (
      token_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES administradores(id), expira_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS eventos (
      id TEXT PRIMARY KEY, titulo TEXT NOT NULL, data TEXT NOT NULL,
      turma TEXT NOT NULL CHECK(turma IN ('geral','turma_a','turma_b')), descricao TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS atendimentos (
      id TEXT PRIMARY KEY, professor TEXT NOT NULL, materia TEXT NOT NULL, area TEXT NOT NULL,
      dia INTEGER NOT NULL CHECK(dia BETWEEN 0 AND 6), inicio TEXT NOT NULL, fim TEXT NOT NULL,
      sala TEXT NOT NULL, email TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inscritos (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      turma TEXT NOT NULL CHECK(turma IN ('turma_a','turma_b')),
      ativo INTEGER NOT NULL DEFAULT 0, criado_em INTEGER NOT NULL, confirmado_em INTEGER,
      token_hash TEXT UNIQUE, token_expira INTEGER, ultimo_pedido INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saidas (
      token_hash TEXT PRIMARY KEY, inscrito_id TEXT NOT NULL REFERENCES inscritos(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS execucoes (
      id TEXT PRIMARY KEY, dia TEXT NOT NULL, origem TEXT NOT NULL, inicio INTEGER NOT NULL,
      fim INTEGER, estado TEXT NOT NULL DEFAULT 'executando', enviados INTEGER NOT NULL DEFAULT 0,
      falhas INTEGER NOT NULL DEFAULT 0, resumo TEXT NOT NULL DEFAULT 'não necessário'
    );
    CREATE TABLE IF NOT EXISTS envios (
      id TEXT PRIMARY KEY, chave TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL,
      inscrito_id TEXT REFERENCES inscritos(id) ON DELETE SET NULL,
      evento_id TEXT REFERENCES eventos(id) ON DELETE SET NULL,
      evento_titulo TEXT, evento_data TEXT, antecedencia INTEGER,
      estado TEXT NOT NULL, criado_em INTEGER NOT NULL, enviado_em INTEGER,
      execucao_id TEXT REFERENCES execucoes(id), detalhe TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data);
    CREATE INDEX IF NOT EXISTS idx_envios_estado ON envios(estado);
    CREATE INDEX IF NOT EXISTS idx_envios_criado ON envios(criado_em DESC);
