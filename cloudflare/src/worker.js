import { auth, session } from './auth.js';
import { catalogo } from './catalogo.js';
import { avisos, scheduled } from './avisos.js';
import { statusIA, usoIA, perguntar } from './ia.js';
import { body, fail, json, rateLimit } from './db.js';
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url),
      path = url.pathname,
      method = request.method;
    if (!path.startsWith('/api/'))
      return env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response('Campus Hub: compile o frontend.', { status: 503 });
    try {
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method))
        throw fail('Método não permitido.', 405);
      if (method !== 'GET') {
        const origin = env.PUBLIC_URL;
        if (
          !origin ||
          request.headers.get('Origin') !== origin ||
          request.headers.get('X-Campus-Hub') !== '1'
        )
          throw fail('Origem da requisição não permitida.', 403);
      }
      if (path.startsWith('/api/auth/')) return await auth(request, env);
      if (path === '/api/health' && method === 'GET') return json({ status: 'ok' });
      const adminRoute =
        path.startsWith('/api/admin/') ||
        (method !== 'GET' && /^\/api\/(eventos|atendimentos)(\/|$)/.test(path));
      if (adminRoute && !(await session(request, env)))
        throw fail('Entre como administrador para continuar.', 401);
      if (path === '/api/admin/ia/uso' && method === 'GET') return json(await usoIA(env));
      let data;
      if (method !== 'GET') {
        if (path === '/api/assistente/perguntar') await rateLimit(request, env, 'ia', 10);
        else if (path.startsWith('/api/avisos/'))
          await rateLimit(request, env, path, path.endsWith('/inscrever') ? 5 : 20);
        else if (adminRoute) await rateLimit(request, env, 'admin', 60);
        const hasJsonBody = request.headers
          .get('content-type')
          ?.toLowerCase()
          .startsWith('application/json');
        // DELETE sem corpo (como excluir um cadastro) não deve passar pelo parser JSON.
        data = hasJsonBody ? await body(request) : {};
      }
      const result =
        (await catalogo(request, env, data)) || (await avisos(request, env, data, ctx));
      if (result) return result;
      if (path === '/api/assistente/status' && method === 'GET') return json(await statusIA(env));
      if (path === '/api/assistente/perguntar' && method === 'POST') {
        if (Object.keys(data).length !== 1 || !('pergunta' in data))
          throw fail('Confira a pergunta.');
        return json(await perguntar(env, data.pergunta));
      }
      return json({ error: 'Rota não encontrada.' }, 404);
    } catch (error) {
      const status = error.status || error.statusCode || 500;
      return json(
        {
          error:
            status >= 500
              ? 'Serviço indisponível. Confira a configuração ou tente novamente.'
              : error.message,
        },
        status,
      );
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(scheduled(env));
  },
};
