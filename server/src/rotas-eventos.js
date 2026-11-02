import { randomUUID, createHash } from 'node:crypto';
import { listarEventos, inserirEvento } from './banco.js';
import { validarData, erroHttp, objeto, texto, dataSchema, validarPeriodo } from './validacao.js';
const schemaEvento = {
  type: 'object',
  required: ['titulo', 'data', 'turma', 'descricao'],
  additionalProperties: false,
  properties: {
    titulo: { type: 'string', minLength: 1, maxLength: 120 },
    data: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    turma: { type: 'string', enum: ['geral', 'turma_a', 'turma_b'] },
    descricao: { type: 'string', maxLength: 1000 },
  },
};

function validarEvento(body) {
  validarData(body.data);
  if (!body.titulo.trim()) throw erroHttp('Informe um título.');
  return {
    titulo: body.titulo.trim(),
    data: body.data,
    turma: body.turma,
    descricao: body.descricao.trim(),
  };
}

export function registrarEventos(app, { db, exigirAdmin }) {
  app.get('/api/eventos', async () => ({ eventos: listarEventos(db) }));
  app.post(
    '/api/eventos',
    { onRequest: exigirAdmin, schema: { body: schemaEvento } },
    async (request, reply) => {
      const evento = { ...validarEvento(request.body), id: randomUUID() };
      inserirEvento(db, evento);
      return reply.code(201).send({ evento });
    },
  );
  app.put(
    '/api/eventos/:id',
    { onRequest: exigirAdmin, schema: { body: schemaEvento } },
    async (request, reply) => {
      const dados = validarEvento(request.body);
      const result = db
        .prepare('UPDATE eventos SET titulo=?,data=?,turma=?,descricao=? WHERE id=?')
        .run(dados.titulo, dados.data, dados.turma, dados.descricao, request.params.id);
      if (!result.changes)
        return reply.code(404).send({ error: 'Evento não encontrado. Atualize a lista.' });
      return { evento: { ...dados, id: request.params.id } };
    },
  );
  app.delete('/api/eventos/:id', { onRequest: exigirAdmin }, async (request, reply) => {
    const result = db.prepare('DELETE FROM eventos WHERE id=?').run(request.params.id);
    if (!result.changes)
      return reply.code(404).send({ error: 'Evento não encontrado. Atualize a lista.' });
    return { ok: true };
  });
  const protegido = { onRequest: exigirAdmin };
  function previa(periodo) {
    validarPeriodo(periodo);
    const eventos = db
      .prepare('SELECT * FROM eventos WHERE data BETWEEN ? AND ? ORDER BY data,id')
      .all(periodo.inicio, periodo.fim);
    return {
      eventos,
      assinatura: createHash('sha256').update(JSON.stringify(eventos)).digest('hex'),
    };
  }
  const periodo = { inicio: dataSchema, fim: dataSchema };
  app.post(
    '/api/eventos/periodo/previa',
    { ...protegido, schema: { body: objeto(periodo) } },
    async (request) => previa(request.body),
  );
  app.delete(
    '/api/eventos/periodo',
    { ...protegido, schema: { body: objeto({ ...periodo, assinatura: texto(64, 64) }) } },
    async (request) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const atual = previa(request.body);
        if (atual.assinatura !== request.body.assinatura)
          throw erroHttp('A lista mudou. Confira uma nova prévia antes de excluir.', 409);
        db.prepare('DELETE FROM eventos WHERE data BETWEEN ? AND ?').run(
          request.body.inicio,
          request.body.fim,
        );
        db.exec('COMMIT');
        return { removidos: atual.eventos.map((e) => e.id) };
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  );
}
