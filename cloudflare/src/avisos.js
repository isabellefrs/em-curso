import { criarEmailBrevo } from './email-brevo.js';
import { emailEstudantil } from '../../server/src/validacao.js';
import { all, one, run, statement, hash, token, fail, json } from './db.js';
const DIA = 86400000;
export const diaLocal = (t) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(t));
const addDays = (day, n) =>
  new Date(Date.parse(day + 'T12:00:00Z') + n * DIA).toISOString().slice(0, 10);
const format = (day) => day.split('-').reverse().join('/');
export const emailEnabled = (env) =>
  env.EMAIL_ENABLED === 'true' &&
  env.EMAIL_PROVIDER === 'brevo' &&
  Boolean(env.BREVO_API_KEY && env.EMAIL_FROM && env.ADMIN_REPORT_EMAIL && env.PUBLIC_URL);
const emailService = (env) => criarEmailBrevo({ ...env, NODE_ENV: 'production' });
const link = (env, action, key) => `${env.PUBLIC_URL}/avisos#${action}=${key}`;
const mensagem =
  'Se o endereço precisar de confirmação, você receberá um link válido por 24 horas. Confira também o spam. Aguarde 15 minutos antes de solicitar outro link.';
const emailDiagnostic = (error) => {
  const parts = [];
  if (typeof error?.code === 'string' && /^[A-Z0-9_-]{1,24}$/i.test(error.code))
    parts.push(`código ${error.code}`);
  if (Number.isInteger(error?.responseCode) && error.responseCode >= 400 && error.responseCode <= 599)
    parts.push(`resposta ${error.responseCode}`);
  const command = typeof error?.command === 'string' ? error.command.toUpperCase() : '';
  if (
    ['API', 'AUTH', 'CONNECT', 'CONN', 'GREETING', 'MAIL FROM', 'RCPT TO', 'DATA', 'END DATA', 'QUIT', 'STARTTLS', 'EHLO', 'HELO'].includes(command)
  )
    parts.push(`etapa ${command}`);
  return parts.length
    ? `Falha no envio (${parts.join('; ')}).`
    : 'Falha no envio sem código técnico disponível; confira a configuração do provedor.';
};
async function deliver(env, id, message, sender) {
  let email;
  try {
    email = sender || emailService(env);
    await email.enviar({ ...message, id });
    await run(env.DB, "UPDATE envios SET estado='enviado',enviado_em=? WHERE id=?", Date.now(), id);
    return true;
  } catch (error) {
    await run(
      env.DB,
      "UPDATE envios SET estado='incerto',detalhe=? WHERE id=?",
      emailDiagnostic(error),
      id,
    );
    return false;
  } finally {
    if (!sender) email?.fechar();
  }
}
export async function subscribe(env, b, sender) {
  if (!emailEnabled(env)) throw fail('Os avisos aguardam configuração do e-mail.', 503);
  if (
    typeof b.nome !== 'string' ||
    !b.nome.trim() ||
    b.nome.length > 100 ||
    typeof b.email !== 'string' ||
    !['turma_a', 'turma_b'].includes(b.turma) ||
    b.consentimento !== true ||
    Object.keys(b).length !== 4
  )
    throw fail('Confira nome, e-mail, turma e consentimento.');
  const address = emailEstudantil(b.email),
    now = Date.now(),
    key = token(),
    candidate = crypto.randomUUID();
  // Uma única operação condicional impede dois cadastros concorrentes de substituir o token.
  const row = await one(
    env.DB,
    `INSERT INTO inscritos(id,nome,email,turma,criado_em,token_hash,token_expira,ultimo_pedido)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET nome=excluded.nome,turma=excluded.turma,token_hash=excluded.token_hash,token_expira=excluded.token_expira,ultimo_pedido=excluded.ultimo_pedido
    WHERE inscritos.ativo=0 AND inscritos.ultimo_pedido<=? RETURNING id`,
    candidate,
    b.nome.trim(),
    address,
    b.turma,
    now,
    await hash(key),
    now + DIA,
    now,
    now - 900000,
  );
  if (row) {
    const id = crypto.randomUUID();
    await run(
      env.DB,
      "INSERT INTO envios(id,chave,tipo,inscrito_id,estado,criado_em) VALUES(?,?,'confirmacao',?,'enviando',?)",
      id,
      id,
      row.id,
      now,
    );
    await deliver(
      env,
      id,
      {
        to: address,
        subject: 'Confirme seus avisos · Em Curso',
        text: `Olá, ${b.nome.trim()}!\n\nConfirme sua inscrição para receber os eventos da ${b.turma === 'turma_a' ? 'Turma A' : 'Turma B'} e os eventos gerais, com 7, 3 e 1 dia de antecedência:\n${link(env, 'confirmar', key)}\n\nO link expira em 24 horas. Se não foi você, ignore esta mensagem.`,
      },
      sender,
    );
  }
  return { mensagem };
}
export async function enqueue(env, origem = 'manual') {
  if (!emailEnabled(env)) throw fail('Os avisos aguardam configuração do e-mail.', 503);
  const db = env.DB,
    now = Date.now(),
    day = diaLocal(now);
  const existing = await one(
    db,
    "SELECT id FROM execucoes WHERE estado='executando' ORDER BY inicio LIMIT 1",
  );
  if (existing)
    return {
      id: existing.id,
      mensagem: 'Uma verificação está em andamento. Acompanhe o histórico.',
    };
  const id = crypto.randomUUID();
  const commands =
    origem === 'automatico'
      ? [
          statement(db, 'INSERT OR IGNORE INTO agenda_cloudflare VALUES(?,?)', [day, id]),
          statement(
            db,
            "INSERT INTO execucoes(id,dia,origem,inicio) SELECT ?,?,'automatico',? WHERE EXISTS(SELECT 1 FROM agenda_cloudflare WHERE dia=? AND execucao=?)",
            [id, day, now, day, id],
          ),
        ]
      : [
          statement(db, 'INSERT INTO execucoes(id,dia,origem,inicio) VALUES(?,?,?,?)', [
            id,
            day,
            origem,
            now,
          ]),
        ];
  // Planejamento SQL evita um subrequest por aluno e preserva a chave de deduplicação.
  commands.push(
    ...[7, 3, 1].map((n) =>
      statement(
        db,
        `INSERT OR IGNORE INTO envios(id,chave,tipo,inscrito_id,evento_id,evento_titulo,evento_data,antecedencia,estado,criado_em,execucao_id)
    SELECT lower(hex(randomblob(16))),i.id||':'||e.id||':'||e.data||':'||?, 'lembrete',i.id,e.id,e.titulo,e.data,?,'pendente',?,?
    FROM eventos e JOIN inscritos i ON i.ativo=1 AND (e.turma='geral' OR e.turma=i.turma) WHERE e.data=? AND EXISTS(SELECT 1 FROM execucoes WHERE id=?)`,
        [n, n, now, id, addDays(day, n), id],
      ),
    ),
  );
  const result = await db.batch(commands);
  if (origem === 'automatico' && !result[1].meta.changes) return null;
  return { id, mensagem: 'Verificação iniciada. Acompanhe o histórico abaixo.' };
}
export async function processQueue(env, sender) {
  if (!emailEnabled(env)) return;
  const db = env.DB,
    owner = token(),
    now = Date.now();
  const claimed = await run(
    db,
    `INSERT INTO trava_rotina VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET dono=excluded.dono,expira=excluded.expira WHERE trava_rotina.expira<?`,
    owner,
    now + 180000,
    now,
  );
  if (!claimed) return;
  try {
    // Uma conexão interrompida nunca é reenviada automaticamente.
    await run(
      db,
      "UPDATE envios SET estado='incerto',detalhe='Processamento interrompido; confira o provedor.' WHERE estado='enviando' AND criado_em<?",
      now - 600000,
    );
    const job = await one(
      db,
      "SELECT * FROM execucoes WHERE estado='executando' ORDER BY inicio,id LIMIT 1",
    );
    if (!job) return;
    const pending = await all(
      db,
      "SELECT id FROM envios WHERE tipo='lembrete' AND estado='pendente' AND execucao_id=? ORDER BY criado_em,id LIMIT 3",
      job.id,
    );
    for (const item of pending) {
      const row = await one(
        db,
        `SELECT v.*,i.nome,i.email,i.turma aluno_turma,e.titulo,e.descricao,e.data,e.turma FROM envios v
        JOIN inscritos i ON i.id=v.inscrito_id AND i.ativo=1 JOIN eventos e ON e.id=v.evento_id
        WHERE v.id=? AND v.estado='pendente'`,
        item.id,
      );
      if (
        !row ||
        row.data !== row.evento_data ||
        row.data !== addDays(diaLocal(Date.now()), row.antecedencia) ||
        (row.turma !== 'geral' && row.turma !== row.aluno_turma)
      ) {
        await run(
          db,
          "UPDATE envios SET estado='cancelado' WHERE id=? AND estado='pendente'",
          item.id,
        );
        continue;
      }
      if (
        !(await run(
          db,
          "UPDATE envios SET estado='enviando',criado_em=? WHERE id=? AND estado='pendente'",
          Date.now(),
          item.id,
        ))
      )
        continue;
      const key = token();
      await run(db, 'INSERT INTO saidas VALUES(?,?)', await hash(key), row.inscrito_id);
      await deliver(
        env,
        item.id,
        {
          to: row.email,
          subject: `Faltam ${row.antecedencia} dia(s): ${row.titulo}`,
          text: `Olá, ${row.nome}!\n\n${row.titulo}\nData: ${format(row.data)}\n${row.descricao}\n\nCalendário: ${env.PUBLIC_URL}\nCancelar avisos: ${link(env, 'cancelar', key)}`,
        },
        sender,
      );
    }
    const counts = await one(
      db,
      `SELECT SUM(estado='pendente') pendentes,SUM(estado='enviando') processando,SUM(estado='enviado') enviados,SUM(estado='incerto') falhas FROM envios WHERE execucao_id=? AND tipo='lembrete'`,
      job.id,
    );
    if (counts.pendentes || counts.processando) return;
    const sent = counts.enviados || 0,
      failed = counts.falhas || 0;
    if (sent || failed) {
      const summaryId = crypto.randomUUID();
      const inserted = await run(
        db,
        "INSERT OR IGNORE INTO envios(id,chave,tipo,estado,criado_em,execucao_id) VALUES(?,?,'resumo','enviando',?,?)",
        summaryId,
        'resumo:' + job.id,
        Date.now(),
        job.id,
      );
      if (inserted)
        await deliver(
          env,
          summaryId,
          {
            to: env.ADMIN_REPORT_EMAIL || 'admin@example.com',
            subject: `Em Curso · resumo de ${format(job.dia)}`,
            text: `Lembretes aceitos pelo provedor de e-mail: ${sent}\nEnvios não confirmados: ${failed}\n\nConfira o histórico na administração. Aceitação do provedor não garante chegada à caixa de entrada.`,
          },
          sender,
        );
    }
    const summary = await one(db, 'SELECT estado FROM envios WHERE chave=?', 'resumo:' + job.id);
    await run(
      db,
      "UPDATE execucoes SET estado='concluida',fim=?,enviados=?,falhas=?,resumo=? WHERE id=?",
      Date.now(),
      sent,
      failed,
      summary?.estado || 'não necessário',
      job.id,
    );
  } finally {
    await run(db, 'DELETE FROM trava_rotina WHERE id=1 AND dono=?', owner);
  }
}
export async function scheduled(env) {
  await env.DB.batch([
    statement(env.DB, 'DELETE FROM limites WHERE expira<?', [Date.now()]),
    statement(env.DB, 'DELETE FROM oauth_estados WHERE expira<?', [Date.now()]),
    statement(env.DB, 'DELETE FROM sessoes_google WHERE expira<?', [Date.now()]),
    statement(env.DB, 'DELETE FROM previa_exclusao WHERE expira<?', [Date.now()]),
  ]);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  );
  if (emailEnabled(env) && hour >= Number(env.REMINDER_HOUR || 8)) await enqueue(env, 'automatico');
  await processQueue(env);
}
async function panel(env) {
  const result = await one(
    env.DB,
    `SELECT
    (SELECT COUNT(*) FROM inscritos WHERE ativo=1) ativos,(SELECT COUNT(*) FROM inscritos WHERE ativo=0) pendentes,
    (SELECT COUNT(*) FROM eventos) eventos,(SELECT COUNT(*) FROM envios WHERE estado='enviado') enviados,
    (SELECT COUNT(*) FROM envios WHERE estado='enviado' AND tipo='lembrete') lembretes,
    (SELECT COUNT(*) FROM envios WHERE estado IN ('enviando','incerto')) incertos,
    (SELECT COUNT(*) FROM execucoes WHERE estado='executando') executando`,
  );
  return {
    ...result,
    habilitado: emailEnabled(env),
    executando: result.executando > 0,
    fila: await one(env.DB, `SELECT SUM(estado='pendente') pendentes,SUM(estado='incerto') atencao FROM envios WHERE tipo='lembrete'`),
    ultimaAutomatica: await one(env.DB, `SELECT * FROM execucoes WHERE origem='automatico' ORDER BY inicio DESC LIMIT 1`),
    execucoes: await all(env.DB, 'SELECT * FROM execucoes ORDER BY inicio DESC LIMIT 20'),
  };
}
export async function avisos(request, env, b, ctx) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method,
    db = env.DB;
  if (path === '/api/avisos/status' && method === 'GET')
    return json({ habilitado: emailEnabled(env), dominio: 'aluno.ifsp.edu.br' });
  if (path === '/api/avisos/inscrever' && method === 'POST') return json(await subscribe(env, b));
  if (['/api/avisos/confirmar', '/api/avisos/cancelar'].includes(path) && method === 'POST') {
    if (
      Object.keys(b).length !== 1 ||
      typeof b.token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(b.token)
    )
      throw fail('Link inválido.');
    const h = await hash(b.token);
    if (path.endsWith('/confirmar')) {
      if (
        !(await run(
          db,
          'UPDATE inscritos SET ativo=1,confirmado_em=?,token_hash=NULL,token_expira=NULL WHERE token_hash=? AND token_expira>? AND ativo=0',
          Date.now(),
          h,
          Date.now(),
        ))
      )
        throw fail('Link inválido, já utilizado ou expirado.');
      return json({ mensagem: 'E-mail confirmado! Seus avisos estão ativos.' });
    }
    await run(
      db,
      'DELETE FROM inscritos WHERE id IN (SELECT inscrito_id FROM saidas WHERE token_hash=?)',
      h,
    );
    return json({
      mensagem: 'Inscrição cancelada, se o link era válido. Você não receberá novos lembretes.',
    });
  }
  if (path === '/api/admin/avisos' && method === 'GET') return json(await panel(env));
  if (path === '/api/admin/inscritos' && method === 'GET')
    return json({
      inscritos: await all(
        db,
        'SELECT id,nome,email,turma,ativo,criado_em,confirmado_em FROM inscritos ORDER BY nome,email',
      ),
    });
  if (path.startsWith('/api/admin/inscritos/') && method === 'DELETE') {
    await run(db, 'DELETE FROM inscritos WHERE id=?', path.split('/').at(-1));
    return json({ ok: true });
  }
  if (path === '/api/admin/envios' && method === 'GET') {
    const p = url.searchParams.get('pagina') || '1';
    if (!/^[1-9][0-9]{0,5}$/.test(p) || [...url.searchParams.keys()].some((k) => k !== 'pagina'))
      throw fail('Página inválida.');
    const pagina = Number(p),
      { total } = await one(db, 'SELECT COUNT(*) total FROM envios');
    const envios = await all(
      db,
      `SELECT e.*,i.nome,i.email FROM envios e LEFT JOIN inscritos i ON i.id=e.inscrito_id ORDER BY e.criado_em DESC,e.id DESC LIMIT 25 OFFSET ?`,
      (pagina - 1) * 25,
    );
    return json({
      total,
      pagina,
      paginas: Math.max(1, Math.ceil(total / 25)),
      envios: envios.map(({ chave, ...row }) => row),
    });
  }
  if (path === '/api/admin/lembretes/executar' && method === 'POST') {
    const result = await enqueue(env);
    ctx.waitUntil(processQueue(env));
    return json(result, 202);
  }
  return null;
}
