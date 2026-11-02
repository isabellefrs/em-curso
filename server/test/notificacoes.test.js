import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { abrirBanco, inserirEvento } from '../src/banco.js';
import { criarNotificacoes, diaLocal, somarDias } from '../src/notificacoes.js';
import { iniciarAgendador } from '../src/agendador.js';

function preparar(t, opcoes = {}) {
  const db = abrirBanco(':memory:');
  t.after(() => db.close());
  let tempo = Date.parse('2026-10-30T12:00:00Z');
  const mensagens = [];
  const email = {
    habilitado: true,
    siteUrl: 'https://campus.example',
    adminEmail: 'admin@example.test',
    async enviar(m) {
      mensagens.push(m);
    },
    ...opcoes,
  };
  const notificacoes = criarNotificacoes({ db, email, agora: () => tempo });
  const aluno = (turma = 'turma_a', ativo = 1) => {
    const id = randomUUID();
    db.prepare(
      'INSERT INTO inscritos(id,nome,email,turma,ativo,criado_em,ultimo_pedido) VALUES(?,?,?,?,?,?,?)',
    ).run(id, 'Aluno teste', id + '@aluno.ifsp.edu.br', turma, ativo, tempo, tempo);
    return id;
  };
  const evento = (dias, turma = 'geral') => {
    const id = randomUUID();
    inserirEvento(db, {
      id,
      titulo: 'Evento de teste',
      data: somarDias(diaLocal(tempo), dias),
      turma,
      descricao: 'Teste',
    });
    return id;
  };
  return {
    db,
    mensagens,
    notificacoes,
    aluno,
    evento,
    agora: () => tempo,
    avancar: (n) => {
      tempo += n;
    },
  };
}
const extrairToken = (m, acao) => m.text.match(new RegExp(`#${acao}=([a-f0-9]{64})`))[1];

test('inscrição restrita, confirmação expira e token não é armazenado em texto puro', async (t) => {
  const f = preparar(t);
  await assert.rejects(
    f.notificacoes.cadastrar({ nome: 'Teste', email: 'teste@gmail.com', turma: 'turma_a' }),
    /aluno.ifsp/,
  );
  await f.notificacoes.cadastrar({
    nome: 'Teste',
    email: 'teste@aluno.ifsp.edu.br',
    turma: 'turma_a',
  });
  const chave = extrairToken(f.mensagens[0], 'confirmar');
  const aluno = f.db.prepare('SELECT * FROM inscritos').get();
  assert.notEqual(aluno.token_hash, chave);
  assert.equal(aluno.token_hash, createHash('sha256').update(chave).digest('hex'));
  assert.equal(aluno.ativo, 0);
  f.avancar(86400001);
  assert.throws(() => f.notificacoes.confirmar(chave), /expirado/);
  await f.notificacoes.cadastrar({ nome: 'Teste', email: aluno.email, turma: 'turma_b' });
  const novo = extrairToken(f.mensagens[1], 'confirmar');
  assert.throws(() => f.notificacoes.confirmar(chave), /inválido/);
  f.notificacoes.confirmar(novo);
  assert.equal(f.db.prepare('SELECT ativo FROM inscritos').get().ativo, 1);
  assert.throws(() => f.notificacoes.confirmar(novo), /utilizado/);
  await f.notificacoes.cadastrar({ nome: 'Outra pessoa', email: aluno.email, turma: 'turma_a' });
  assert.equal(f.db.prepare('SELECT turma FROM inscritos').get().turma, 'turma_b');
});

test('lembretes 7/3/1 respeitam turma e confirmação; repetição não duplica nem envia resumo vazio', async (t) => {
  const f = preparar(t);
  const a = f.aluno('turma_a'),
    b = f.aluno('turma_b');
  f.aluno('turma_a', 0);
  for (const dias of [7, 3, 1, 2, 0, -1]) f.evento(dias);
  f.evento(7, 'turma_a');
  f.evento(7, 'turma_b');
  f.notificacoes.iniciar();
  await f.notificacoes.aguardar();
  const lembretes = f.db.prepare("SELECT * FROM envios WHERE tipo='lembrete'").all();
  assert.equal(lembretes.length, 8);
  assert.equal(lembretes.filter((e) => e.inscrito_id === a).length, 4);
  assert.equal(lembretes.filter((e) => e.inscrito_id === b).length, 4);
  assert.equal(f.mensagens.length, 9); // Oito lembretes e um resumo.
  assert.equal(f.mensagens.at(-1).to, 'admin@example.test');
  f.notificacoes.iniciar();
  await f.notificacoes.aguardar();
  assert.equal(f.mensagens.length, 9);
  assert.equal(f.notificacoes.painel().ativos, 2);
});

test('cancelamento funciona por link anterior e remove dados pessoais preservando contagens', async (t) => {
  const f = preparar(t);
  f.aluno();
  f.evento(7);
  f.evento(3);
  f.notificacoes.iniciar();
  await f.notificacoes.aguardar();
  const chave = extrairToken(f.mensagens[0], 'cancelar');
  f.notificacoes.cancelar(chave);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM inscritos').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM saidas').get().n, 0);
  assert.equal(
    f.db.prepare('SELECT COUNT(*) n FROM envios WHERE inscrito_id IS NOT NULL').get().n,
    0,
  );
  assert.equal(f.notificacoes.painel().lembretes, 2);
  f.notificacoes.cancelar(chave); // Repetir é inofensivo.
});

test('falha SMTP fica incerta e não é reenviada automaticamente', async (t) => {
  let tentativas = 0;
  const f = preparar(t, {
    async enviar() {
      tentativas++;
      throw new Error('Falha com credenciais confidenciais');
    },
  });
  f.aluno();
  f.evento(1);
  f.notificacoes.iniciar();
  await f.notificacoes.aguardar();
  assert.equal(f.notificacoes.painel().lembretes, 0);
  assert.equal(f.notificacoes.painel().incertos, 2); // Lembrete e resumo.
  assert.ok(!JSON.stringify(f.notificacoes.painel()).includes('credenciais'));
  f.notificacoes.iniciar();
  await f.notificacoes.aguardar();
  assert.equal(tentativas, 2);
});

test('execuções concorrentes são recusadas e evento removido da fila não é enviado', async (t) => {
  let liberar,
    primeira = true;
  const espera = new Promise((resolve) => {
    liberar = resolve;
  });
  const f = preparar(t, {
    async enviar() {
      if (primeira) {
        primeira = false;
        await espera;
      }
    },
  });
  f.aluno();
  f.evento(7);
  f.evento(3);
  f.notificacoes.iniciar();
  assert.throws(() => f.notificacoes.iniciar(), /andamento/);
  const pendente = f.db.prepare("SELECT evento_id FROM envios WHERE estado='pendente'").get();
  f.db.prepare('DELETE FROM eventos WHERE id=?').run(pendente.evento_id);
  liberar();
  await f.notificacoes.aguardar();
  assert.equal(
    f.db.prepare("SELECT COUNT(*) n FROM envios WHERE tipo='lembrete' AND estado='enviado'").get()
      .n,
    1,
  );
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM envios WHERE estado='cancelado'").get().n, 1);
});

test('sem SMTP não cria inscrição, fila ou falsa confirmação de envio', async (t) => {
  const f = preparar(t, { habilitado: false });
  await assert.rejects(
    f.notificacoes.cadastrar({ nome: 'Teste', email: 'x@aluno.ifsp.edu.br', turma: 'turma_a' }),
    /configuração/,
  );
  assert.throws(() => f.notificacoes.iniciar(), /configuração/);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM inscritos').get().n, 0);
});

test('datas civis usam São Paulo e rotina automática só inicia uma vez por dia', async (t) => {
  assert.equal(diaLocal(Date.parse('2026-10-31T01:00:00Z')), '2026-10-30');
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
  const f = preparar(t);
  const iniciar = () =>
    iniciarAgendador({ db: f.db, notificacoes: f.notificacoes, agora: f.agora, hora: 8 });
  let parar = iniciar();
  parar();
  await f.notificacoes.aguardar();
  parar = iniciar();
  parar();
  await f.notificacoes.aguardar();
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM execucoes').get().n, 1);
  f.avancar(86400000);
  parar = iniciar();
  parar();
  await f.notificacoes.aguardar();
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM execucoes').get().n, 2);
});
