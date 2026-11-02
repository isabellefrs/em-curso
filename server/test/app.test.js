import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';
import { abrirBanco, inserirEvento, listarEventos } from '../src/banco.js';
import { criarAdministrador, hashToken } from '../src/autenticacao.js';
import { buildApp } from '../src/app.js';

const origem = { origin: 'http://127.0.0.1:5175', 'x-campus-hub': '1' };
const dados = {
  titulo: 'Prova de teste',
  data: '2026-11-05',
  turma: 'turma_a',
  descricao: 'Somente teste',
};

async function preparar(t) {
  const db = abrirBanco(':memory:');
  const senha = randomUUID();
  await criarAdministrador(db, 'teste', senha);
  let tempo = Date.now();
  const app = await buildApp({ db, agora: () => tempo });
  t.after(async () => {
    await app.close();
    db.close();
  });
  const login = () =>
    app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: origem,
      payload: { usuario: 'teste', senha },
    });
  return {
    db,
    app,
    login,
    avancar: () => {
      tempo += 9 * 60 * 60 * 1000;
    },
  };
}

test('consulta pública funciona e todas as operações de escrita exigem sessão', async (t) => {
  const { app } = await preparar(t);
  assert.equal((await app.inject('/api/eventos')).statusCode, 200);
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const response = await app.inject({
      method,
      url: '/api/eventos' + (method === 'POST' ? '' : '/inexistente'),
      headers: origem,
      ...(method === 'DELETE' ? {} : { payload: dados }),
    });
    assert.equal(response.statusCode, 401);
  }
});

test('login cria cookie HttpOnly e sessão revogável, token bruto não vai ao banco', async (t) => {
  const { app, db, login } = await preparar(t);
  const response = await login();
  assert.equal(response.statusCode, 200);
  const setCookie = response.headers['set-cookie'];
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = setCookie.split(';')[0];
  const token = cookie.split('=')[1];
  assert.equal(db.prepare('SELECT token_hash FROM sessoes').get().token_hash, hashToken(token));
  assert.equal(
    (await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().admin.usuario,
    'teste',
  );
  assert.equal(
    (await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { ...origem, cookie } }))
      .statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().admin,
    null,
  );
});

test('sessão expirada e cookie adulterado são recusados', async (t) => {
  const { app, login, avancar } = await preparar(t);
  const cookie = (await login()).headers['set-cookie'].split(';')[0];
  avancar();
  for (const valor of [cookie, 'campus_hub_session=invalido']) {
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/api/eventos',
          headers: { ...origem, cookie: valor },
          payload: dados,
        })
      ).statusCode,
      401,
    );
  }
});

test('origem externa ou cabeçalho ausente bloqueia escrita mesmo autenticada', async (t) => {
  const { app, login } = await preparar(t);
  const cookie = (await login()).headers['set-cookie'].split(';')[0];
  for (const headers of [
    { ...origem, origin: 'https://outro.example', cookie },
    { origin: origem.origin, cookie },
  ]) {
    assert.equal(
      (await app.inject({ method: 'POST', url: '/api/eventos', headers, payload: dados }))
        .statusCode,
      403,
    );
  }
});

test('CRUD autenticado e validações de data, título e turma', async (t) => {
  const { app, login } = await preparar(t);
  const cookie = (await login()).headers['set-cookie'].split(';')[0];
  const headers = { ...origem, cookie };
  for (const invalido of [
    { ...dados, titulo: '   ' },
    { ...dados, data: '2026-02-30' },
    { ...dados, turma: 'outra' },
    { ...dados, titulo: 123 },
    { ...dados, data: 'x' },
  ]) {
    assert.equal(
      (await app.inject({ method: 'POST', url: '/api/eventos', headers, payload: invalido }))
        .statusCode,
      400,
    );
  }
  const criado = await app.inject({ method: 'POST', url: '/api/eventos', headers, payload: dados });
  assert.equal(criado.statusCode, 201);
  const id = criado.json().evento.id;
  assert.equal((await app.inject('/api/eventos')).json().eventos.length, 1);
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: `/api/eventos/${id}`,
        headers,
        payload: { ...dados, titulo: 'Atualizado' },
      })
    ).json().evento.titulo,
    'Atualizado',
  );
  assert.equal(
    (await app.inject({ method: 'DELETE', url: `/api/eventos/${id}`, headers })).statusCode,
    200,
  );
  assert.equal((await app.inject('/api/eventos')).json().eventos.length, 0);
  assert.equal(
    (await app.inject({ method: 'DELETE', url: `/api/eventos/${id}`, headers })).statusCode,
    404,
  );
});

test('login inválido usa mensagem genérica e limita tentativas', async (t) => {
  const { app } = await preparar(t);
  for (let i = 0; i < 5; i++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: origem,
      payload: { usuario: i % 2 ? 'teste' : 'desconhecido', senha: 'errada' },
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, 'Usuário ou senha inválidos.');
  }
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: origem,
        payload: { usuario: 'teste', senha: 'errada' },
      })
    ).statusCode,
    429,
  );
});

test('banco mantém eventos ao fechar e reabrir sem repopular após exclusão', () => {
  const caminho = join(tmpdir(), `campus-hub-test-${randomUUID()}.sqlite`);
  let db;
  try {
    db = abrirBanco(caminho);
    inserirEvento(db, { ...dados, id: randomUUID() });
    db.close();
    db = abrirBanco(caminho);
    assert.equal(listarEventos(db).length, 1);
    db.prepare('DELETE FROM eventos').run();
    db.close();
    db = abrirBanco(caminho);
    assert.equal(listarEventos(db).length, 0);
  } finally {
    db?.close();
    for (const arquivo of [caminho, `${caminho}-wal`, `${caminho}-shm`])
      if (existsSync(arquivo)) unlinkSync(arquivo);
  }
});
