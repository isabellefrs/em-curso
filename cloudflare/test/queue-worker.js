import { enqueue, processQueue, subscribe, avisos } from '../src/avisos.js';
export default {
  async fetch(request, env) {
    const messages = [];
    const sender = {
      async enviar(message) {
        messages.push(message);
        if (new URL(request.url).searchParams.has('falhar'))
          throw new Error('segredo fictício que não pode ir para o histórico');
      },
    };
    const path = new URL(request.url).pathname;
    if (path === '/subscribe') {
      try {
        return Response.json({
          result: await subscribe(env, await request.json(), sender),
          messages,
        });
      } catch (e) {
        return Response.json({ error: e.message }, { status: e.status || e.statusCode || 500 });
      }
    }
    if (path.startsWith('/api/avisos/')) {
      try {
        return await avisos(request, env, await request.json(), {});
      } catch (e) {
        return Response.json({ error: e.message }, { status: e.status || e.statusCode || 500 });
      }
    }
    const job = await enqueue(
      env,
      new URL(request.url).searchParams.has('manual') ? 'manual' : 'automatico',
    );
    await processQueue(env, sender);
    return Response.json({ job, messages });
  },
};
