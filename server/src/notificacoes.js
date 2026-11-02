import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { erroHttp, emailEstudantil } from './validacao.js';

const hash = (valor) => createHash('sha256').update(valor).digest('hex');
const token = () => randomBytes(32).toString('hex');
const DIA = 86400000;
export const diaLocal = (tempo) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(tempo));
export const somarDias = (dia, dias) =>
  new Date(Date.parse(dia + 'T12:00:00Z') + dias * DIA).toISOString().slice(0, 10);
const formatarData = (data) => data.split('-').reverse().join('/');
const RESPOSTA_CADASTRO =
  'Se o endereço precisar de confirmação, você receberá um link válido por 24 horas. Confira também o spam. Aguarde 15 minutos antes de solicitar outro link.';

export function criarNotificacoes({ db, email, agora = Date.now }) {
  let executando = false;
  let tarefa = Promise.resolve();
  const link = (acao, chave) => `${email.siteUrl}/avisos#${acao}=${chave}`;
  function exigirEmail() {
    if (!email.habilitado)
      throw erroHttp('Os avisos ainda aguardam a configuração do e-mail da turma.', 503);
  }
  async function entregar(id, mensagem) {
    try {
      await email.enviar({ ...mensagem, id });
      db.prepare("UPDATE envios SET estado='enviado', enviado_em=? WHERE id=?").run(agora(), id);
      return true;
    } catch {
      // SMTP pode aceitar uma mensagem antes de a conexão cair. Não reenviar automaticamente.
      db.prepare(
        "UPDATE envios SET estado='incerto', detalhe='Não foi possível confirmar o envio. Confira o provedor antes de reenviar.' WHERE id=?",
      ).run(id);
      return false;
    }
  }
  async function cadastrar({ nome, email: endereco, turma }) {
    exigirEmail();
    endereco = emailEstudantil(endereco);
    nome = nome.trim();
    if (!nome) throw erroHttp('Informe seu nome.');
    const existente = db.prepare('SELECT * FROM inscritos WHERE email=?').get(endereco);
    if (existente?.ativo || (existente && agora() - existente.ultimo_pedido < 15 * 60000))
      return { mensagem: RESPOSTA_CADASTRO };
    const id = existente?.id || randomUUID(),
      chave = token();
    db.prepare(
      `INSERT INTO inscritos(id,nome,email,turma,criado_em,token_hash,token_expira,ultimo_pedido)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET nome=excluded.nome,turma=excluded.turma,
      token_hash=excluded.token_hash,token_expira=excluded.token_expira,ultimo_pedido=excluded.ultimo_pedido`,
    ).run(id, nome, endereco, turma, agora(), hash(chave), agora() + DIA, agora());
    const envioId = randomUUID();
    db.prepare(
      "INSERT INTO envios(id,chave,tipo,inscrito_id,estado,criado_em) VALUES(?,?,'confirmacao',?,'enviando',?)",
    ).run(envioId, envioId, id, agora());
    await entregar(envioId, {
      to: endereco,
      subject: 'Confirme seus avisos · Campus Hub',
      text: `Olá, ${nome}!\n\nVocê escolheu a ${turma === 'turma_a' ? 'turma A' : 'turma B'}. Confirme para receber os avisos de sua turma e os eventos gerais, com 7, 3 e 1 dia de antecedência:\n\n${link('confirmar', chave)}\n\nO link expira em 24 horas. Se não foi você, ignore esta mensagem. Nenhum aviso será enviado antes da confirmação.`,
    });
    return { mensagem: RESPOSTA_CADASTRO };
  }
  function confirmar(chave) {
    const result = db
      .prepare(
        `UPDATE inscritos SET ativo=1,confirmado_em=?,token_hash=NULL,token_expira=NULL
      WHERE token_hash=? AND token_expira>? AND ativo=0`,
      )
      .run(agora(), hash(chave), agora());
    if (!result.changes)
      throw erroHttp(
        'Link inválido, já utilizado ou expirado. Solicite um novo cadastro se necessário.',
      );
    return { mensagem: 'E-mail confirmado! Seus avisos estão ativos.' };
  }
  function painel() {
    const numero = (sql) => db.prepare(sql).get().total;
    return {
      habilitado: email.habilitado,
      executando,
      ativos: numero('SELECT COUNT(*) total FROM inscritos WHERE ativo=1'),
      pendentes: numero('SELECT COUNT(*) total FROM inscritos WHERE ativo=0'),
      eventos: numero('SELECT COUNT(*) total FROM eventos'),
      enviados: numero("SELECT COUNT(*) total FROM envios WHERE estado='enviado'"),
      lembretes: numero(
        "SELECT COUNT(*) total FROM envios WHERE estado='enviado' AND tipo='lembrete'",
      ),
      incertos: numero("SELECT COUNT(*) total FROM envios WHERE estado IN ('incerto','enviando')"),
      execucoes: db.prepare('SELECT * FROM execucoes ORDER BY inicio DESC LIMIT 20').all(),
    };
  }
  function planejar(dia, execucao) {
    const inserir =
      db.prepare(`INSERT OR IGNORE INTO envios(id,chave,tipo,inscrito_id,evento_id,evento_titulo,evento_data,antecedencia,estado,criado_em,execucao_id)
      VALUES(?,?,'lembrete',?,?,?,?,?,'pendente',?,?)`);
    for (const dias of [7, 3, 1]) {
      const pares = db
        .prepare(
          `SELECT e.*,i.id inscrito FROM eventos e JOIN inscritos i ON i.ativo=1 AND (e.turma='geral' OR e.turma=i.turma) WHERE e.data=?`,
        )
        .all(somarDias(dia, dias));
      for (const e of pares)
        inserir.run(
          randomUUID(),
          `${e.inscrito}:${e.id}:${e.data}:${dias}`,
          e.inscrito,
          e.id,
          e.titulo,
          e.data,
          dias,
          agora(),
          execucao,
        );
    }
  }
  async function processar(execucao, dia) {
    let enviados = 0,
      falhas = 0;
    try {
      planejar(dia, execucao);
      const fila = db
        .prepare(
          "SELECT * FROM envios WHERE tipo='lembrete' AND estado='pendente' ORDER BY criado_em,id",
        )
        .all();
      for (const item of fila) {
        const aluno = db
          .prepare('SELECT * FROM inscritos WHERE id=? AND ativo=1')
          .get(item.inscrito_id);
        const evento = db.prepare('SELECT * FROM eventos WHERE id=?').get(item.evento_id);
        if (
          !aluno ||
          !evento ||
          evento.data !== item.evento_data ||
          evento.data !== somarDias(diaLocal(agora()), item.antecedencia) ||
          (evento.turma !== 'geral' && evento.turma !== aluno.turma)
        ) {
          db.prepare("UPDATE envios SET estado='cancelado' WHERE id=? AND estado='pendente'").run(
            item.id,
          );
          continue;
        }
        if (
          !db
            .prepare(
              "UPDATE envios SET estado='enviando',execucao_id=?,evento_titulo=? WHERE id=? AND estado='pendente'",
            )
            .run(execucao, evento.titulo, item.id).changes
        )
          continue;
        // Guarda somente o hash; links de lembretes anteriores continuam válidos.
        const saida = token();
        db.prepare('INSERT INTO saidas(token_hash,inscrito_id) VALUES(?,?)').run(
          hash(saida),
          aluno.id,
        );
        const sucesso = await entregar(item.id, {
          to: aluno.email,
          subject: `Falta${item.antecedencia === 1 ? '' : 'm'} ${item.antecedencia} dia${item.antecedencia === 1 ? '' : 's'}: ${evento.titulo}`,
          text: `Olá, ${aluno.nome}!\n\n${evento.titulo}\nData: ${formatarData(evento.data)}\nPúblico: ${evento.turma === 'geral' ? 'Todas as turmas' : evento.turma === 'turma_a' ? 'Turma A' : 'Turma B'}\n${evento.descricao}\n\nEste aviso foi enviado ${item.antecedencia} dia(s) antes do evento.\nCalendário: ${email.siteUrl}\n\nCancelar seus avisos: ${link('cancelar', saida)}`,
        });
        if (sucesso) enviados++;
        else falhas++;
      }
      let resumo = 'não necessário';
      if (enviados || falhas) {
        const id = randomUUID();
        db.prepare(
          "INSERT INTO envios(id,chave,tipo,estado,criado_em,execucao_id) VALUES(?,?,'resumo','enviando',?,?)",
        ).run(id, id, agora(), execucao);
        resumo = (await entregar(id, {
          to: email.adminEmail,
          subject: `Campus Hub · resumo dos lembretes de ${formatarData(dia)}`,
          text: `Rotina concluída.\nLembretes aceitos pelo SMTP: ${enviados}\nEnvios não confirmados: ${falhas}\n\nConfira o histórico na administração. Aceitação pelo SMTP não garante chegada à caixa de entrada.`,
        }))
          ? 'enviado'
          : 'incerto';
      }
      db.prepare(
        "UPDATE execucoes SET fim=?,estado='concluida',enviados=?,falhas=?,resumo=? WHERE id=?",
      ).run(agora(), enviados, falhas, resumo, execucao);
    } catch {
      db.prepare("UPDATE execucoes SET fim=?,estado='falhou',enviados=?,falhas=? WHERE id=?").run(
        agora(),
        enviados,
        falhas,
        execucao,
      );
    } finally {
      executando = false;
    }
  }
  function iniciar(origem = 'manual') {
    exigirEmail();
    if (executando) throw erroHttp('Uma verificação já está em andamento.', 409);
    const id = randomUUID(),
      dia = diaLocal(agora());
    db.prepare('INSERT INTO execucoes(id,dia,origem,inicio) VALUES(?,?,?,?)').run(
      id,
      dia,
      origem,
      agora(),
    );
    executando = true;
    tarefa = processar(id, dia);
    return { id, mensagem: 'Verificação iniciada. Acompanhe o histórico abaixo.' };
  }
  function cancelarPorLink(chave) {
    const registro = db
      .prepare('SELECT inscrito_id FROM saidas WHERE token_hash=?')
      .get(hash(chave));
    if (registro) db.prepare('DELETE FROM inscritos WHERE id=?').run(registro.inscrito_id);
    return {
      mensagem: 'Inscrição cancelada, se o link era válido. Você não receberá novos lembretes.',
    };
  }
  return {
    cadastrar,
    confirmar,
    cancelar: cancelarPorLink,
    painel,
    iniciar,
    aguardar: () => tarefa,
  };
}
