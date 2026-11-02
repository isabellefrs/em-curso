import { hash, token, one, run, fail, json, rateLimit, body } from './db.js';

const COOKIE = 'campus_hub_session';
const SESSION_MS = 8 * 60 * 60 * 1000;
const encoder = new TextEncoder();

export const configured = (env) =>
  Boolean(
    env.ADMIN_USERNAME?.trim() &&
      env.ADMIN_USERNAME.trim().length <= 40 &&
      env.ADMIN_PASSWORD &&
      env.ADMIN_PASSWORD.length >= 12 &&
      env.ADMIN_PASSWORD.length <= 128 &&
      env.PUBLIC_URL,
  );

const cookieValue = (request, name) =>
  request.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + '='))
    ?.slice(name.length + 1);

const cookie = (name, value, maxAge) =>
  name + '=' + value + '; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=' + maxAge;

function sameHash(left, right) {
  let difference = left.length ^ right.length;
  const size = Math.max(left.length, right.length);
  for (let i = 0; i < size; i++) {
    const a = left.charCodeAt(i % left.length) || 0;
    const b = right.charCodeAt(i % right.length) || 0;
    difference |= a ^ b;
  }
  return difference === 0;
}

export async function session(request, env) {
  const value = cookieValue(request, COOKIE);
  if (!/^[a-f0-9]{64}$/.test(value || '')) return null;
  const usuario = env.ADMIN_USERNAME?.trim().toLowerCase();
  if (!usuario) return null;
  const row = await one(
    env.DB,
    'SELECT usuario FROM sessoes_admin WHERE hash=? AND expira>?',
    await hash(value),
    Date.now(),
  );
  return row?.usuario === usuario ? { id: usuario, usuario } : null;
}

export async function auth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/auth/session' && request.method === 'GET')
    return json({
      admin: await session(request, env),
      configurado: configured(env),
      metodo: 'senha',
    });

  if (path === '/api/auth/logout' && request.method === 'POST') {
    const value = cookieValue(request, COOKIE);
    if (value) await run(env.DB, 'DELETE FROM sessoes_admin WHERE hash=?', await hash(value));
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(COOKIE, '', 0) });
  }

  if (path === '/api/auth/login' && request.method === 'POST') {
    if (!configured(env)) throw fail('O usuário e a senha administrativos ainda não foram configurados.', 503);
    await rateLimit(request, env, 'admin-login', 5);
    const data = await body(request);
    const usuario = typeof data.usuario === 'string' ? data.usuario.trim().toLowerCase() : '';
    const senha = typeof data.senha === 'string' ? data.senha : '';
    if (!usuario || usuario.length > 40 || senha.length < 12 || senha.length > 128)
      throw fail('Usuário ou senha inválidos.', 401);

    const esperado = await hash('campus-hub-admin:' + env.ADMIN_USERNAME.trim().toLowerCase() + ':' + env.ADMIN_PASSWORD);
    const recebido = await hash('campus-hub-admin:' + usuario + ':' + senha);
    if (!sameHash(esperado, recebido)) throw fail('Usuário ou senha inválidos.', 401);

    const value = token();
    const anterior = cookieValue(request, COOKIE);
    if (anterior) await run(env.DB, 'DELETE FROM sessoes_admin WHERE hash=?', await hash(anterior));
    await run(env.DB, 'DELETE FROM sessoes_admin WHERE expira<=?', Date.now());
    await run(
      env.DB,
      'INSERT INTO sessoes_admin(hash,usuario,expira) VALUES(?,?,?)',
      await hash(value),
      usuario,
      Date.now() + SESSION_MS,
    );
    return json(
      { admin: { id: usuario, usuario } },
      200,
      { 'Set-Cookie': cookie(COOKIE, value, Math.floor(SESSION_MS / 1000)) },
    );
  }

  return json({ error: 'Rota de autenticação indisponível.' }, 404);
}