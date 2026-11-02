import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare as Runtime, convertV4MiniflareOptions } from 'miniflare';
const Miniflare = class extends Runtime {
  constructor(options) {
    super(convertV4MiniflareOptions(options));
  }
};

const root = fileURLToPath(new URL('../', import.meta.url));
const compatibilityDate = '2026-10-23';
const options = { modules: true, compatibilityDate, compatibilityFlags: ['nodejs_compat'] };
async function appRuntime(t, extra = {}) {
  await mkdir(root + '.build', { recursive: true });
  await build({
    entryPoints: [root + 'src/worker.js'],
    outfile: root + '.build/app-test.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    external: ['node:*'],
    logLevel: 'silent',
  });
  const mf = new Miniflare({
    ...options,
    scriptPath: root + '.build/app-test.js',
    d1Databases: ['DB'],
    bindings: {
      PUBLIC_URL: 'https://example.test',
      ADMIN_GOOGLE_EMAIL: 'admin@example.test',
      EMAIL_ENABLED: 'false',
      ...(extra.bindings || {}),
    },
    outboundService:
      extra.outboundService ||
      (() => {
        throw new Error('Conexão externa inesperada.');
      }),
  });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const file of ['0001_schema.sql', '0002_cloudflare.sql'])
    await db.exec((await readFile(root + 'migrations/' + file, 'utf8')).replace(/\r?\n/g, ' '));
  return { mf, db };
}

test('OAuth completo: PKCE, cookie, assinatura Google, sessão, replay e logout', async (t) => {
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const { createHash } = await import('node:crypto');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'teste', alg: 'RS256', use: 'sig' };
  let nonce,
    challenge,
    calls = 0;
  const { mf, db } = await appRuntime(t, {
    bindings: { GOOGLE_CLIENT_ID: 'client-ficticio', GOOGLE_CLIENT_SECRET: 'secret-ficticio' },
    outboundService: async (request) => {
      const url = new URL(request.url);
      if (url.href === 'https://www.googleapis.com/oauth2/v3/certs')
        return Response.json({ keys: [jwk] });
      assert.equal(url.href, 'https://oauth2.googleapis.com/token');
      calls++;
      const form = new URLSearchParams(await request.text());
      assert.equal(form.get('redirect_uri'), 'https://example.test/api/auth/google/callback');
      assert.equal(form.get('client_secret'), 'secret-ficticio');
      assert.equal(
        createHash('sha256').update(form.get('code_verifier')).digest('base64url'),
        challenge,
      );
      return Response.json({
        id_token: await new SignJWT({ email: 'admin@example.test', email_verified: true, nonce })
          .setProtectedHeader({ alg: 'RS256', kid: 'teste' })
          .setSubject('google-test')
          .setIssuer('https://accounts.google.com')
          .setAudience('client-ficticio')
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(privateKey),
      });
    },
  });
  const start = await mf.dispatchFetch('https://example.test/api/auth/google', {
    redirect: 'manual',
  });
  assert.equal(start.status, 302);
  const target = new URL(start.headers.get('location'));
  assert.equal(target.hostname, 'accounts.google.com');
  nonce = target.searchParams.get('nonce');
  challenge = target.searchParams.get('code_challenge');
  const state = target.searchParams.get('state');
  assert.equal(target.searchParams.get('scope'), 'openid email');
  const callback = 'https://example.test/api/auth/google/callback?code=ficticio&state=' + state;
  const wrong = await mf.dispatchFetch(callback, { redirect: 'manual' });
  assert.match(wrong.headers.get('location'), /acesso=negado/);
  assert.equal(calls, 0);
  const result = await mf.dispatchFetch(callback, {
    redirect: 'manual',
    headers: { Cookie: 'campus_oauth=' + state },
  });
  assert.equal(result.headers.get('location'), 'https://example.test/admin');
  assert.equal(calls, 1);
  const cookie = result.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  const sessionCookie = cookie.match(/campus_hub_session=([a-f0-9]{64})/)[0];
  const stored = await db.prepare('SELECT hash FROM sessoes_google').first();
  assert.notEqual(stored.hash, sessionCookie.split('=')[1]);
  const current = await (
    await mf.dispatchFetch('https://example.test/api/auth/session', {
      headers: { Cookie: sessionCookie },
    })
  ).json();
  assert.equal(current.admin.usuario, 'admin@example.test');
  const replay = await mf.dispatchFetch(callback, {
    redirect: 'manual',
    headers: { Cookie: 'campus_oauth=' + state },
  });
  assert.match(replay.headers.get('location'), /acesso=negado/);
  assert.equal(calls, 1);
  const logout = await mf.dispatchFetch('https://example.test/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: sessionCookie, Origin: 'https://example.test', 'X-Campus-Hub': '1' },
  });
  assert.equal(logout.status, 200);
  assert.equal(
    (
      await (
        await mf.dispatchFetch('https://example.test/api/auth/session', {
          headers: { Cookie: sessionCookie },
        })
      ).json()
    ).admin,
    null,
  );
});

test('D1: schema, persistência entre requisições, turmas e privacidade', async (t) => {
  const { mf, db } = await appRuntime(t);
  await db.batch([
    db
      .prepare('INSERT INTO eventos(id,titulo,data,turma,descricao) VALUES(?,?,?,?,?)')
      .bind('a', 'Prova A', '2026-11-01', 'turma_a', ''),
    db
      .prepare('INSERT INTO eventos(id,titulo,data,turma,descricao) VALUES(?,?,?,?,?)')
      .bind('g', 'Geral', '2026-11-02', 'geral', ''),
    db
      .prepare(
        'INSERT INTO inscritos(id,nome,email,turma,criado_em,ultimo_pedido) VALUES(?,?,?,?,?,?)',
      )
      .bind('aluno', 'Fictício', 'teste@aluno.ifsp.edu.br', 'turma_a', 1, 1),
  ]);
  const first = await (await mf.dispatchFetch('http://localhost/api/eventos')).json();
  assert.deepEqual(
    first.eventos.map((e) => e.turma),
    ['turma_a', 'geral'],
  );
  const second = await (await mf.dispatchFetch('http://localhost/api/eventos')).json();
  assert.deepEqual(first, second);
  assert.equal((await mf.dispatchFetch('http://localhost/api/admin/inscritos')).status, 401);
  assert.equal(
    (await mf.dispatchFetch('http://localhost/api/eventos', { method: 'POST', body: '{}' })).status,
    403,
  );
  assert.equal((await db.prepare('SELECT COUNT(*) total FROM inscritos').first()).total, 1);
});

test('Admin: sessão restrita, CRUD, prévia desatualizada e exclusão atômica de vários eventos', async (t) => {
  const { mf, db } = await appRuntime(t);
  const { createHash } = await import('node:crypto');
  const value = 'a'.repeat(64),
    h = createHash('sha256').update(value).digest('hex');
  await db
    .prepare('INSERT INTO sessoes_google VALUES(?,?,?,?)')
    .bind(h, 'google-sub', 'admin@example.test', Date.now() + 60000)
    .run();
  const call = (path, method = 'GET', data) =>
    mf.dispatchFetch('https://example.test/api' + path, {
      method,
      headers: {
        Cookie: 'campus_hub_session=' + value,
        Origin: 'https://example.test',
        'X-Campus-Hub': '1',
        ...(data ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  assert.equal((await (await call('/auth/session')).json()).admin.usuario, 'admin@example.test');
  for (const id of ['a', 'b', 'c'])
    assert.equal(
      (
        await call('/eventos', 'POST', {
          titulo: id,
          data: '2026-11-01',
          turma: 'geral',
          descricao: '',
        })
      ).status,
      201,
    );
  const periodo = { inicio: '2026-11-01', fim: '2026-11-01' };
  const stale = await (await call('/eventos/periodo/previa', 'POST', periodo)).json();
  await call('/eventos', 'POST', {
    titulo: 'novo',
    data: '2026-11-01',
    turma: 'turma_b',
    descricao: '',
  });
  assert.equal(
    (await call('/eventos/periodo', 'DELETE', { ...periodo, assinatura: stale.assinatura })).status,
    409,
  );
  assert.equal((await (await call('/eventos')).json()).eventos.length, 4);
  const fresh = await (await call('/eventos/periodo/previa', 'POST', periodo)).json();
  const deleted = await call('/eventos/periodo', 'DELETE', {
    ...periodo,
    assinatura: fresh.assinatura,
  });
  assert.equal(deleted.status, 200, await deleted.clone().text());
  assert.equal((await deleted.json()).removidos.length, 4);
  assert.equal((await (await call('/eventos')).json()).eventos.length, 0);
  const a = {
    professor: 'Fictício',
    materia: 'Física',
    area: 'exatas',
    dia: 2,
    inicio: '10:00',
    fim: '11:00',
    sala: '1',
    email: 'teste@example.test',
  };
  assert.equal((await call('/atendimentos', 'POST', { ...a, fim: '09:00' })).status, 400);
  const teacher = await (await call('/atendimentos', 'POST', a)).json();
  assert.ok(teacher.atendimento.id);
  assert.equal((await call('/atendimentos/' + teacher.atendimento.id, 'DELETE')).status, 200);
  await db.prepare('UPDATE sessoes_google SET email=?').bind('intruso@example.test').run();
  assert.equal((await call('/admin/inscritos')).status, 401);
});

test('IA: consulta documental e recusa fora do escopo sem chave real', async (t) => {
  const { mf, db } = await appRuntime(t);
  const chunk = {
    id: 'doc',
    documentId: 'doc',
    title: 'Matrícula',
    text: 'Emita a declaração de matrícula pelo SUAP.',
    page: 1,
  };
  await db
    .prepare('INSERT INTO conhecimento VALUES(?,?,?)')
    .bind('doc', 'campus', JSON.stringify(chunk))
    .run();
  await db
    .prepare('INSERT INTO conhecimento_fts VALUES(?,?)')
    .bind('doc', chunk.title + ' ' + chunk.text)
    .run();
  const ask = (pergunta) =>
    mf.dispatchFetch('https://example.test/api/assistente/perguntar', {
      method: 'POST',
      headers: {
        Origin: 'https://example.test',
        'X-Campus-Hub': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pergunta }),
    });
  const r = await ask('Como emitir declaração de matrícula no SUAP?');
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal((await r.json()).fontes[0].pagina, 1);
  assert.equal((await (await ask('Qual a capital da França?')).json()).modo, 'recusa');
  assert.equal((await ask('" OR * ) DROP TABLE eventos; --')).status, 200);
});

test('D1: lote atômico, restrição de turma e exclusão de tokens por cascata', async (t) => {
  const mf = new Miniflare({
    ...options,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ['DB'],
  });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  await db.exec(
    (await readFile(root + 'migrations/0001_schema.sql', 'utf8')).replace(/\r?\n/g, ' '),
  );
  await assert.rejects(
    db.batch([
      db.prepare("INSERT INTO eventos VALUES('valido','Título','2026-11-01','geral','')"),
      db.prepare("INSERT INTO eventos VALUES('invalido','Título','2026-11-01','turma_c','')"),
    ]),
  );
  assert.equal((await db.prepare('SELECT COUNT(*) total FROM eventos').first()).total, 0);
  await db
    .prepare(
      "INSERT INTO inscritos(id,nome,email,turma,criado_em,ultimo_pedido) VALUES('aluno','Teste','teste@aluno.ifsp.edu.br','turma_a',1,1)",
    )
    .run();
  await db.prepare("INSERT INTO saidas VALUES('hash-ficticio','aluno')").run();
  await db.prepare("DELETE FROM inscritos WHERE id='aluno'").run();
  assert.equal((await db.prepare('SELECT COUNT(*) total FROM saidas').first()).total, 0);
});

test('Runtime Workers: senha existente, transporte de e-mail e SDK Gemini com HTTP simulado', async (t) => {
  await mkdir(root + '.build', { recursive: true });
  await build({
    entryPoints: [root + 'test/runtime-worker.js'],
    outfile: root + '.build/runtime.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    external: ['node:*'],
    logLevel: 'silent',
  });
  let chamadas = 0;
  const mf = new Miniflare({
    ...options,
    scriptPath: root + '.build/runtime.js',
    outboundService: async (req) => {
      const url = new URL(req.url);
      assert.equal(url.hostname, 'generativelanguage.googleapis.com');
      assert.equal(req.headers.get('x-goog-api-key'), 'chave-ficticia');
      chamadas++;
      return Response.json({
        candidates: [{ content: { role: 'model', parts: [{ text: 'resposta simulada' }] } }],
      });
    },
  });
  t.after(() => mf.dispose());
  const cryptoResponse = await mf.dispatchFetch('http://localhost/crypto');
  assert.equal(cryptoResponse.status, 200, await cryptoResponse.clone().text());
  assert.deepEqual(await cryptoResponse.json(), { correta: true, incorreta: false, tokenHash: 64 });
  assert.deepEqual(await (await mf.dispatchFetch('http://localhost/email')).json(), {
    habilitado: true,
    envioReal: false,
  });
  assert.deepEqual(await (await mf.dispatchFetch('http://localhost/gemini')).json(), {
    texto: 'resposta simulada',
  });
  assert.equal(chamadas, 1);
});
