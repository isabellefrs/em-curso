import { randomBytes } from 'node:crypto';
import { criarSessao, lerSessao, hashToken, hashSenha, verificarSenha } from './autenticacao.js';
export const COOKIE = 'campus_hub_session';
export async function registrarAuth(app, { db, agora, secureCookie }) {
  const senhaFalsa = await hashSenha(randomBytes(32).toString('hex'));
  const cookieOptions = {
    path: '/api',
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookie,
    maxAge: 8 * 60 * 60,
  };
  app.get('/api/auth/session', async (request) => ({
    admin: lerSessao(db, request.cookies[COOKIE], agora()),
    configurado: Boolean(db.prepare('SELECT id FROM administradores LIMIT 1').get()),
  }));
  app.post(
    '/api/auth/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
      schema: {
        body: {
          type: 'object',
          required: ['usuario', 'senha'],
          additionalProperties: false,
          properties: {
            usuario: { type: 'string', minLength: 3, maxLength: 40 },
            senha: { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      const admin = db
        .prepare('SELECT * FROM administradores WHERE usuario=?')
        .get(request.body.usuario);
      const valida = await verificarSenha(request.body.senha, admin?.senha_hash || senhaFalsa);
      if (!admin || !valida) return reply.code(401).send({ error: 'Usuário ou senha inválidos.' });
      const anterior = request.cookies[COOKIE];
      if (anterior) db.prepare('DELETE FROM sessoes WHERE token_hash=?').run(hashToken(anterior));
      const token = criarSessao(db, admin.id, agora());
      reply.setCookie(COOKIE, token, cookieOptions);
      return { admin: { id: admin.id, usuario: admin.usuario } };
    },
  );
  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[COOKIE];
    if (token) db.prepare('DELETE FROM sessoes WHERE token_hash=?').run(hashToken(token));
    reply.clearCookie(COOKIE, {
      path: '/api',
      httpOnly: true,
      sameSite: 'strict',
      secure: secureCookie,
    });
    return { ok: true };
  });
}
