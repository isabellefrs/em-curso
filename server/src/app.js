import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { lerSessao } from './autenticacao.js';
import { registrarAuth, COOKIE } from './rotas-auth.js';
import { registrarEventos } from './rotas-eventos.js';
import { registrarAtendimentos } from './rotas-atendimentos.js';
import { registrarAvisos } from './rotas-avisos.js';

export async function buildApp({
  db,
  assistente = null,
  notificacoes = null,
  origins = ['http://127.0.0.1:5175', 'http://localhost:5175'],
  secureCookie = false,
  agora = Date.now,
  logger = false,
}) {
  const app = Fastify({
    logger,
    bodyLimit: 64 * 1024,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    const mensagem = error.validation
      ? 'Confira os campos enviados.'
      : status >= 500 && !error.publico
        ? 'Erro interno no servidor.'
        : status === 429
          ? 'Muitas tentativas. Aguarde 15 minutos.'
          : error.message;
    if (status === 500) request.log.error({ err: error }, 'Falha no servidor');
    reply.code(status).send({ error: mensagem });
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (!origins.includes(request.headers.origin) || request.headers['x-campus-hub'] !== '1') {
        return reply.code(403).send({ error: 'Origem da requisição não permitida.' });
      }
    }
  });

  async function exigirAdmin(request, reply) {
    request.admin = lerSessao(db, request.cookies[COOKIE], agora());
    if (!request.admin)
      return reply.code(401).send({ error: 'Entre como administrador para continuar.' });
  }

  app.get('/api/health', async () => ({ status: 'ok' }));
  app.get('/api/assistente/status', async () => assistente?.status() || { modo: 'indisponivel' });
  app.post(
    '/api/assistente/perguntar',
    {
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
      schema: {
        body: {
          type: 'object',
          required: ['pergunta'],
          additionalProperties: false,
          properties: { pergunta: { type: 'string', minLength: 1, maxLength: 1200 } },
        },
      },
    },
    async (request, reply) => {
      if (!assistente) return reply.code(503).send({ error: 'Assistente indisponível.' });
      return assistente.perguntar(request.body.pergunta);
    },
  );
  await registrarAuth(app, { db, agora, secureCookie });
  registrarEventos(app, { db, exigirAdmin });
  registrarAtendimentos(app, { db, exigirAdmin });
  registrarAvisos(app, { db, exigirAdmin, notificacoes });
  return app;
}
