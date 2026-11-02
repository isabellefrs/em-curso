import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
const root = fileURLToPath(new URL('../', import.meta.url));
async function setup(t) {
  await mkdir(root + '.build', { recursive: true });
  await build({
    entryPoints: [root + 'test/queue-worker.js'],
    outfile: root + '.build/queue-test.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    external: ['node:*'],
    logLevel: 'silent',
  });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      compatibilityDate: '2026-10-23',
      compatibilityFlags: ['nodejs_compat'],
      scriptPath: root + '.build/queue-test.js',
      d1Databases: ['DB'],
      bindings: {
        EMAIL_ENABLED: 'true',
        SMTP_PASSWORD: 'ficticia',
        PUBLIC_URL: 'https://example.test',
        ADMIN_REPORT_EMAIL: 'admin@example.test',
      },
      outboundService() {
        throw new Error('Nenhuma conexão externa permitida nos testes.');
      },
    }),
  );
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const file of ['0001_schema.sql', '0002_cloudflare.sql'])
    await db.exec((await readFile(root + 'migrations/' + file, 'utf8')).replace(/\r?\n/g, ' '));
  const call = async (path, data) => {
    const r = await mf.dispatchFetch(
      'https://example.test' + path,
      data
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }
        : {},
    );
    return { status: r.status, data: await r.json() };
  };
  return { db, call, mf };
}
test('Cadastro D1: domínio, confirmação única, cooldown, conta ativa e cancelamento', async (t) => {
  const { db, call } = await setup(t);
  const input = {
    nome: 'Teste fictício',
    email: 'teste@aluno.ifsp.edu.br',
    turma: 'turma_a',
    consentimento: true,
  };
  assert.equal((await call('/subscribe', { ...input, email: 'teste@gmail.com' })).status, 400);
  const first = await call('/subscribe', input);
  assert.equal(first.status, 200);
  assert.equal(first.data.messages.length, 1);
  const key = first.data.messages[0].text.match(/confirmar=([a-f0-9]{64})/)[1];
  assert.equal(
    (await db.prepare('SELECT token_hash FROM inscritos').first()).token_hash,
    createHash('sha256').update(key).digest('hex'),
  );
  assert.equal((await call('/subscribe', input)).data.messages.length, 0);
  assert.equal((await call('/api/avisos/confirmar', { token: key })).status, 200);
  const replay = await mfStatus(call, '/api/avisos/confirmar', { token: key });
  assert.equal(replay, 400);
  assert.equal((await call('/subscribe', { ...input, turma: 'turma_b' })).data.messages.length, 0);
  assert.equal((await db.prepare('SELECT turma FROM inscritos').first()).turma, 'turma_a');
  const id = (await db.prepare('SELECT id FROM inscritos').first()).id;
  const exit = 'b'.repeat(64);
  await db
    .prepare('INSERT INTO saidas VALUES(?,?)')
    .bind(createHash('sha256').update(exit).digest('hex'), id)
    .run();
  await call('/api/avisos/cancelar', { token: exit });
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM inscritos').first()).n, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM saidas').first()).n, 0);
  assert.equal((await db.prepare('SELECT inscrito_id FROM envios').first()).inscrito_id, null);
});
async function mfStatus(call, path, data) {
  try {
    return (await call(path, data)).status;
  } catch {
    return 500;
  }
}
test('Fila D1: 7/3/1, turmas, resumo único, deduplicação e envio incerto sem repetição', async (t) => {
  const { db, call } = await setup(t);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const day = (n) =>
    new Date(Date.parse(today + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  for (const [id, turma, active] of [
    ['a', 'turma_a', 1],
    ['b', 'turma_b', 1],
    ['p', 'turma_a', 0],
  ])
    await db
      .prepare(
        'INSERT INTO inscritos(id,nome,email,turma,ativo,criado_em,ultimo_pedido) VALUES(?,?,?,?,?,?,?)',
      )
      .bind(id, 'Aluno ' + id, id + '@aluno.ifsp.edu.br', turma, active, 1, 1)
      .run();
  for (const [id, turma, n] of [
    ['g', 'geral', 7],
    ['a', 'turma_a', 3],
    ['b', 'turma_b', 1],
    ['n', 'geral', 2],
  ])
    await db
      .prepare('INSERT INTO eventos VALUES(?,?,?,?,?)')
      .bind(id, 'Evento ' + id, day(n), turma, '')
      .run();
  const messages = [];
  for (let i = 0; i < 4; i++) messages.push(...(await call('/')).data.messages);
  assert.equal(messages.length, 5);
  assert.equal(messages.filter((m) => m.to === 'admin@example.test').length, 1);
  assert.equal(messages.filter((m) => m.to === 'a@aluno.ifsp.edu.br').length, 2);
  assert.equal(messages.filter((m) => m.to === 'b@aluno.ifsp.edu.br').length, 2);
  assert.equal((await call('/?manual')).data.messages.length, 0);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM envios WHERE tipo='lembrete'").first()).n,
    4,
  );
  await db
    .prepare('INSERT INTO eventos VALUES(?,?,?,?,?)')
    .bind('falha', 'Evento incerto', day(1), 'turma_a', '')
    .run();
  const failed = await call('/?manual&falhar');
  assert.ok(failed.data.messages.length >= 1);
  assert.equal((await call('/?manual')).data.messages.length, 0);
  const errors = await db.prepare("SELECT detalhe FROM envios WHERE estado='incerto'").all();
  assert.ok(errors.results.length);
  assert.ok(errors.results.every((e) => !e.detalhe.includes('segredo')));
});
