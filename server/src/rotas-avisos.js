import { objeto, texto, erroHttp } from './validacao.js';
export function registrarAvisos(app, { db, exigirAdmin, notificacoes }) {
  const protegido = { onRequest: exigirAdmin };
  const limite = { rateLimit: { max: 5, timeWindow: '15 minutes' } };
  app.get('/api/avisos/status', async () => ({
    habilitado: Boolean(notificacoes?.painel().habilitado),
    dominio: 'aluno.ifsp.edu.br',
  }));
  const servico = () => {
    if (!notificacoes) throw erroHttp('Avisos indisponíveis.', 503);
    return notificacoes;
  };
  app.post(
    '/api/avisos/inscrever',
    {
      config: limite,
      schema: {
        body: objeto({
          nome: texto(100),
          email: texto(254),
          turma: { enum: ['turma_a', 'turma_b'] },
          consentimento: { const: true },
        }),
      },
    },
    async (request) => servico().cadastrar(request.body),
  );
  for (const acao of ['confirmar', 'cancelar'])
    app.post(
      `/api/avisos/${acao}`,
      {
        config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
        schema: { body: objeto({ token: { type: 'string', pattern: '^[a-f0-9]{64}$' } }) },
      },
      async (request) => servico()[acao](request.body.token),
    );
  app.get('/api/admin/avisos', protegido, async () => servico().painel());
  app.get('/api/admin/inscritos', protegido, async () => ({
    inscritos: db
      .prepare(
        'SELECT id,nome,email,turma,ativo,criado_em,confirmado_em FROM inscritos ORDER BY nome,email',
      )
      .all(),
  }));
  app.delete('/api/admin/inscritos/:id', protegido, async (request) => {
    db.prepare('DELETE FROM inscritos WHERE id=?').run(request.params.id);
    return { ok: true };
  });
  app.get(
    '/api/admin/envios',
    {
      ...protegido,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { pagina: { type: 'string', pattern: '^[1-9][0-9]{0,5}$' } },
        },
      },
    },
    async (request) => {
      const pagina = Number(request.query.pagina || 1);
      const total = db.prepare('SELECT COUNT(*) total FROM envios').get().total;
      return {
        total,
        pagina,
        paginas: Math.max(1, Math.ceil(total / 25)),
        envios: db
          .prepare(
            `SELECT e.*,i.nome,i.email FROM envios e LEFT JOIN inscritos i ON i.id=e.inscrito_id ORDER BY e.criado_em DESC,e.id DESC LIMIT 25 OFFSET ?`,
          )
          .all((pagina - 1) * 25)
          .map(({ chave, ...envio }) => envio),
      };
    },
  );
  app.post(
    '/api/admin/lembretes/executar',
    { ...protegido, config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (request, reply) => reply.code(202).send(servico().iniciar()),
  );
}
