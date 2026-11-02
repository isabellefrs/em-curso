export const statement = (db, sql, args = []) => db.prepare(sql).bind(...args);
export const one = (db, sql, ...args) => statement(db, sql, args).first();
export const all = async (db, sql, ...args) => (await statement(db, sql, args).all()).results;
export const run = async (db, sql, ...args) => (await statement(db, sql, args).run()).meta.changes;
export const hash = async (value) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
export const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
export const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export const json = (value, status = 200, headers = {}) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...headers,
    },
  });

export async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw fail('Envie JSON.', 415);
  const reader = request.body?.getReader();
  let length = 0;
  const parts = [];
  if (!reader) throw fail('Corpo ausente.');
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 65536) {
      await reader.cancel();
      throw fail('Requisição muito grande.', 413);
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const p of parts) {
    bytes.set(p, offset);
    offset += p.length;
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || Array.isArray(data) || typeof data !== 'object') throw 0;
    return data;
  } catch {
    throw fail('JSON inválido.');
  }
}
export async function rateLimit(request, env, group, max) {
  const bucket = Math.floor(Date.now() / 900000);
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const key = await hash(`${group}:${bucket}:${ip}`);
  const row = await one(
    env.DB,
    `INSERT INTO limites(chave,quantidade,expira) VALUES(?,1,?)
    ON CONFLICT(chave) DO UPDATE SET quantidade=quantidade+1 RETURNING quantidade`,
    key,
    (bucket + 1) * 900000,
  );
  if (row.quantidade > max) throw fail('Muitas tentativas. Aguarde 15 minutos.', 429);
}
