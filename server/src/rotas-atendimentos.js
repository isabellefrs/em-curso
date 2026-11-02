import { randomUUID } from 'node:crypto';
import { objeto, texto, emailValido, erroHttp } from './validacao.js';
export function registrarAtendimentos(app, { db, exigirAdmin }) {
  const protegido = { onRequest: exigirAdmin };
  const schemaAtendimento = objeto({
    professor: texto(100),
    materia: texto(100),
    area: {
      enum: ['exatas', 'humanas', 'sociais', 'natureza', 'linguagens', 'tecnologia', 'outras'],
    },
    dia: { type: 'integer', minimum: 0, maximum: 6 },
    inicio: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
    fim: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
    sala: texto(100),
    email: texto(254),
  });
  const listarAtendimentos = () =>
    db.prepare('SELECT * FROM atendimentos ORDER BY dia,inicio,professor').all();
  app.get('/api/atendimentos', async () => ({ atendimentos: listarAtendimentos() }));
  function validarAtendimento(body) {
    const a = Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
    );
    if (!a.professor || !a.materia || !a.sala || !emailValido(a.email) || a.inicio >= a.fim)
      throw erroHttp(
        'Preencha os campos, um e-mail válido e um horário final posterior ao início.',
      );
    return a;
  }
  app.post(
    '/api/atendimentos',
    { ...protegido, schema: { body: schemaAtendimento } },
    async (request, reply) => {
      const a = { id: randomUUID(), ...validarAtendimento(request.body) };
      db.prepare(
        'INSERT INTO atendimentos(id,professor,materia,area,dia,inicio,fim,sala,email) VALUES(?,?,?,?,?,?,?,?,?)',
      ).run(a.id, a.professor, a.materia, a.area, a.dia, a.inicio, a.fim, a.sala, a.email);
      return reply.code(201).send({ atendimento: a });
    },
  );
  app.put(
    '/api/atendimentos/:id',
    { ...protegido, schema: { body: schemaAtendimento } },
    async (request, reply) => {
      const a = validarAtendimento(request.body);
      const resultado = db
        .prepare(
          'UPDATE atendimentos SET professor=?,materia=?,area=?,dia=?,inicio=?,fim=?,sala=?,email=? WHERE id=?',
        )
        .run(
          a.professor,
          a.materia,
          a.area,
          a.dia,
          a.inicio,
          a.fim,
          a.sala,
          a.email,
          request.params.id,
        );
      if (!resultado.changes) return reply.code(404).send({ error: 'Atendimento não encontrado.' });
      return { atendimento: { id: request.params.id, ...a } };
    },
  );
  app.delete('/api/atendimentos/:id', protegido, async (request, reply) => {
    if (!db.prepare('DELETE FROM atendimentos WHERE id=?').run(request.params.id).changes)
      return reply.code(404).send({ error: 'Atendimento não encontrado.' });
    return { ok: true };
  });
}
