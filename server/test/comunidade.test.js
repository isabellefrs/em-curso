import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, inserirEvento } from '../src/banco.js';
import { buildApp } from '../src/app.js';
import { criarSessao } from '../src/autenticacao.js';
import { criarNotificacoes } from '../src/notificacoes.js';

const origem = { origin: 'http://127.0.0.1:5175', 'x-campus-hub': '1' };
async function preparar(t) {
  const db = abrirBanco(':memory:');
  db.prepare('INSERT INTO administradores(id,usuario,senha_hash) VALUES(1,?,?)').run(
    'teste',
    'não usado: testes autenticam por sessão',
  );
  const cookie = `campus_hub_session=${criarSessao(db, 1, Date.now())}`;
  const notificacoes = criarNotificacoes({ db, email: { habilitado: false } });
  const app = await buildApp({ db, notificacoes });
  t.after(async () => {
    await app.close();
    db.close();
  });
  const req = (method, url, payload) =>
    app.inject({
      method,
      url,
      headers: { ...origem, cookie },
      ...(payload === undefined ? {} : { payload }),
    });
  return { db, app, req };
}

test('limpeza inclusiva exige sessão e prévia atual; conflito não remove nada', async (t) => {
  const { db, req, app } = await preparar(t);
  for (const [i, data] of ['2026-10-01', '2026-10-15', '2026-10-31', '2026-11-01'].entries())
    inserirEvento(db, { id: String(i), titulo: 'Teste', turma: 'geral', data, descricao: '' });
  const periodo = { inicio: '2026-10-01', fim: '2026-10-31' };
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/eventos/periodo/previa',
        headers: origem,
        payload: periodo,
      })
    ).statusCode,
    401,
  );
  const previa = (await req('POST', '/api/eventos/periodo/previa', periodo)).json();
  assert.equal(previa.eventos.length, 3);
  db.prepare('UPDATE eventos SET titulo=? WHERE id=?').run('Alterado', '1');
  assert.equal(
    (await req('DELETE', '/api/eventos/periodo', { ...periodo, assinatura: previa.assinatura }))
      .statusCode,
    409,
  );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM eventos').get().n, 4);
  const nova = (await req('POST', '/api/eventos/periodo/previa', periodo)).json();
  assert.equal(
    (
      await req('DELETE', '/api/eventos/periodo', { ...periodo, assinatura: nova.assinatura })
    ).json().removidos.length,
    3,
  );
  assert.equal(db.prepare('SELECT id FROM eventos').get().id, '3');
  assert.equal(
    (await req('POST', '/api/eventos/periodo/previa', { inicio: '2026-02-30', fim: '2026-10-31' }))
      .statusCode,
    400,
  );
  assert.equal(
    (await req('POST', '/api/eventos/periodo/previa', { inicio: periodo.fim, fim: periodo.inicio }))
      .statusCode,
    400,
  );
});

test('atendimento valida horários, permite edição e protege todas as mutações', async (t) => {
  const { req, app } = await preparar(t);
  const dados = {
    professor: 'Professora teste',
    materia: 'Matemática',
    area: 'exatas',
    dia: 2,
    inicio: '14:00',
    fim: '15:00',
    sala: 'Sala 4',
    email: 'professor@example.test',
  };
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/atendimentos',
        headers: origem,
        payload: dados,
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (await req('POST', '/api/atendimentos', { ...dados, fim: '13:00' })).statusCode,
    400,
  );
  assert.equal(
    (await req('POST', '/api/atendimentos', { ...dados, email: 'inválido' })).statusCode,
    400,
  );
  const a = (await req('POST', '/api/atendimentos', dados)).json().atendimento;
  assert.equal((await app.inject('/api/atendimentos')).json().atendimentos.length, 1);
  assert.equal(
    (await req('PUT', `/api/atendimentos/${a.id}`, { ...dados, sala: 'Sala 5' })).json().atendimento
      .sala,
    'Sala 5',
  );
  assert.equal((await req('DELETE', `/api/atendimentos/${a.id}`)).statusCode, 200);
  assert.equal((await app.inject('/api/atendimentos')).json().atendimentos.length, 0);
});

test('cadastros, contagens e histórico são privados; exclusão remove cadastro e tokens', async (t) => {
  const { req, app, db } = await preparar(t);
  for (const url of ['/api/admin/inscritos', '/api/admin/envios', '/api/admin/avisos'])
    assert.equal((await app.inject(url)).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/admin/lembretes/executar',
        headers: origem,
        payload: {},
      })
    ).statusCode,
    401,
  );
  assert.equal((await req('POST', '/api/admin/lembretes/executar', {})).statusCode, 503);
  db.prepare(
    'INSERT INTO inscritos(id,nome,email,turma,ativo,criado_em,ultimo_pedido,token_hash) VALUES(?,?,?,?,?,?,?,?)',
  ).run('teste', 'Aluno', 'teste@aluno.ifsp.edu.br', 'turma_a', 1, 1, 1, 'segredo');
  const lista = (await req('GET', '/api/admin/inscritos')).json();
  assert.ok(!JSON.stringify(lista).includes('segredo'));
  assert.equal((await req('GET', '/api/admin/avisos')).json().ativos, 1);
  await req('DELETE', '/api/admin/inscritos/teste');
  assert.equal((await req('GET', '/api/admin/avisos')).json().ativos, 0);
  assert.equal((await req('GET', '/api/admin/envios?pagina=-1')).statusCode, 400);
});
