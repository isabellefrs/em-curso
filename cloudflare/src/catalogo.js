import { all, one, run, statement, token, hash, fail, json } from './db.js';
import { validarData, validarPeriodo, emailValido } from '../../server/src/validacao.js';
const areas = ['exatas', 'humanas', 'sociais', 'natureza', 'linguagens', 'tecnologia', 'outras'];
const fieldsEvento = ['titulo', 'data', 'turma', 'descricao'];
const fieldsAtendimento = ['professor', 'materia', 'area', 'dia', 'inicio', 'fim', 'sala', 'email'];
function fields(value, names) {
  if (Object.keys(value).length !== names.length || names.some((k) => !(k in value)))
    throw fail('Confira os campos enviados.');
}
function text(value, max, min = 1) {
  if (typeof value !== 'string' || value.length > max || value.trim().length < min)
    throw fail('Confira os campos enviados.');
  return value.trim();
}
export function validateEvento(b) {
  fields(b, fieldsEvento);
  const titulo = text(b.titulo, 120),
    descricao = text(b.descricao, 1000, 0);
  if (typeof b.data !== 'string' || !['geral', 'turma_a', 'turma_b'].includes(b.turma))
    throw fail('Confira data e turma.');
  validarData(b.data);
  return { titulo, data: b.data, turma: b.turma, descricao };
}
export function validateAtendimento(b) {
  fields(b, fieldsAtendimento);
  const a = { ...b };
  for (const k of ['professor', 'materia', 'sala']) a[k] = text(b[k], 100);
  a.email = text(b.email, 254);
  if (
    !areas.includes(a.area) ||
    !Number.isInteger(a.dia) ||
    a.dia < 0 ||
    a.dia > 6 ||
    !emailValido(a.email) ||
    ![a.inicio, a.fim].every(
      (v) => typeof v === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
    ) ||
    a.inicio >= a.fim
  )
    throw fail('Confira área, dia, horários e e-mail.');
  return a;
}
export async function catalogo(request, env, b) {
  const path = new URL(request.url).pathname,
    method = request.method,
    db = env.DB;
  if (path === '/api/eventos/periodo/previa' && method === 'POST') {
    fields(b, ['inicio', 'fim']);
    validarPeriodo(b);
    const [v, list] = await db.batch([
      db.prepare("SELECT numero FROM versoes WHERE nome='eventos'"),
      statement(db, 'SELECT * FROM eventos WHERE data BETWEEN ? AND ? ORDER BY data,id', [
        b.inicio,
        b.fim,
      ]),
    ]);
    const assinatura = token();
    await run(
      db,
      'INSERT INTO previa_exclusao VALUES(?,?,?,?,?)',
      await hash(assinatura),
      b.inicio,
      b.fim,
      v.results[0].numero,
      Date.now() + 600000,
    );
    return json({ assinatura, eventos: list.results });
  }
  if (path === '/api/eventos/periodo' && method === 'DELETE') {
    fields(b, ['inicio', 'fim', 'assinatura']);
    validarPeriodo(b);
    text(b.assinatura, 64, 64);
    const h = await hash(b.assinatura);
    const previo = await one(
      db,
      'SELECT * FROM previa_exclusao WHERE hash=? AND inicio=? AND fim=? AND expira>?',
      h,
      b.inicio,
      b.fim,
      Date.now(),
    );
    if (!previo) throw fail('A prévia expirou. Confira novamente.', 409);
    const removed = await all(
      db,
      `WITH aprovado AS MATERIALIZED (
      SELECT 1 FROM previa_exclusao p JOIN versoes v ON v.nome='eventos' AND v.numero=p.versao
      WHERE p.hash=? AND p.expira>?
    ), alvos AS MATERIALIZED (SELECT id FROM eventos WHERE data BETWEEN ? AND ? AND EXISTS(SELECT 1 FROM aprovado))
    DELETE FROM eventos WHERE id IN (SELECT id FROM alvos) RETURNING id`,
      h,
      Date.now(),
      b.inicio,
      b.fim,
    );
    if (
      !removed.length &&
      (await one(db, "SELECT numero FROM versoes WHERE nome='eventos'")).numero !== previo.versao
    )
      throw fail('A lista mudou. Confira uma nova prévia.', 409);
    await run(db, 'DELETE FROM previa_exclusao WHERE hash=?', h);
    return json({ removidos: removed.map((x) => x.id) });
  }
  const match = path.match(/^\/api\/(eventos|atendimentos)(?:\/([^/]+))?$/);
  if (!match) return null;
  const [, table, id] = match;
  const evento = table === 'eventos',
    key = evento ? 'evento' : 'atendimento';
  const names = evento ? fieldsEvento : fieldsAtendimento;
  if (method === 'GET' && !id)
    return json({
      [table]: await all(
        db,
        `SELECT * FROM ${table} ORDER BY ${evento ? 'data,id' : 'dia,inicio,professor'}`,
      ),
    });
  if (method === 'POST' && !id) {
    const value = (evento ? validateEvento : validateAtendimento)(b);
    const created = { id: crypto.randomUUID(), ...value };
    await run(
      db,
      `INSERT INTO ${table}(id,${names.join(',')}) VALUES(${Array(names.length + 1)
        .fill('?')
        .join(',')})`,
      created.id,
      ...names.map((k) => created[k]),
    );
    return json({ [key]: created }, 201);
  }
  if (method === 'PUT' && id) {
    const value = (evento ? validateEvento : validateAtendimento)(b);
    const changes = await run(
      db,
      `UPDATE ${table} SET ${names.map((k) => k + '=?').join(',')} WHERE id=?`,
      ...names.map((k) => value[k]),
      id,
    );
    if (!changes) throw fail('Registro não encontrado.', 404);
    return json({ [key]: { id, ...value } });
  }
  if (method === 'DELETE' && id) {
    if (!(await run(db, `DELETE FROM ${table} WHERE id=?`, id)))
      throw fail('Registro não encontrado.', 404);
    return json({ ok: true });
  }
  return json({ error: 'Método não permitido.' }, 405);
}
