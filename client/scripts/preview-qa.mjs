// Ambiente descartável: banco em memória e e-mails simulados. Nunca importa .env.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { abrirBanco, inserirEvento } from '../../server/src/banco.js';
import { buildApp } from '../../server/src/app.js';
import { criarSessao } from '../../server/src/autenticacao.js';
import { criarNotificacoes, diaLocal, somarDias } from '../../server/src/notificacoes.js';

if (process.env.NODE_ENV === 'production')
  throw new Error('A prévia QA não pode rodar em produção.');
const db = abrirBanco(':memory:');
const hoje = diaLocal(Date.now()),
  mes = hoje.slice(0, 7);
for (const [i, turma] of ['geral', 'turma_a', 'turma_b'].entries())
  inserirEvento(db, {
    id: randomUUID(),
    titulo: ['Entrega de trabalho INCP', 'Prova de Física', 'Prova de Interfaces Web'][i],
    data: `${mes}-${25 + i}`,
    turma,
    descricao: 'Evento fictício para revisar a interface.',
  });
inserirEvento(db, {
  id: 'amanha',
  titulo: 'Revisão coletiva de teste',
  data: somarDias(hoje, 1),
  turma: 'geral',
  descricao: 'Dado fictício',
});
for (const [i, nome] of ['Ana Exemplo', 'Bruno Exemplo'].entries())
  db.prepare(
    'INSERT INTO inscritos(id,nome,email,turma,ativo,criado_em,ultimo_pedido) VALUES(?,?,?,?,1,?,?)',
  ).run(
    `aluno-${i}`,
    nome,
    `qa-${i}@aluno.ifsp.edu.br`,
    i ? 'turma_b' : 'turma_a',
    Date.now(),
    Date.now(),
  );
for (const [i, professor, materia, area] of [
  [1, 'Marina Exemplo', 'Matemática', 'exatas'],
  [2, 'Rafael Exemplo', 'História', 'humanas'],
  [3, 'Joana Exemplo', 'Interfaces Web', 'tecnologia'],
])
  db.prepare('INSERT INTO atendimentos VALUES(?,?,?,?,?,?,?,?,?)').run(
    `prof-${i}`,
    professor,
    materia,
    area,
    i,
    '14:00',
    '15:00',
    `Sala ${i + 2}`,
    `prof-${i}@example.test`,
  );
db.prepare('INSERT INTO administradores VALUES(1,?,?)').run(
  'prévia-local',
  'autenticação temporária por sessão de teste',
);
const sessao = criarSessao(db, 1, Date.now());
const mensagens = [];
const notificacoes = criarNotificacoes({
  db,
  email: {
    habilitado: true,
    siteUrl: 'http://127.0.0.1:5176',
    adminEmail: 'admin@example.test',
    async enviar(m) {
      mensagens.push(m);
    },
  },
});
const app = await buildApp({ db, notificacoes, origins: ['http://127.0.0.1:5176'] });
app.get('/api/qa/entrar', async (request, reply) =>
  reply
    .setCookie('campus_hub_session', sessao, { httpOnly: true, sameSite: 'strict', path: '/api' })
    .redirect('/admin'),
);
await app.listen({ host: '127.0.0.1', port: 3002 });
const vite = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  configFile: false,
  plugins: [
    react(),
    {
      name: 'qa-banner',
      transformIndexHtml: (html) =>
        html.replace(
          '<body>',
          '<body><aside style="padding:8px;background:#D3AF37;color:#101c2e;text-align:center;font: bold 14px Arial">PRÉVIA DE TESTE · dados fictícios · nenhum e-mail real</aside>',
        ),
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5176,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3002' },
  },
});
await vite.listen();
console.log('Prévia QA: http://127.0.0.1:5176/ · Administração: /api/qa/entrar');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await vite.close();
    await app.close();
    await notificacoes.aguardar();
    db.close();
    process.exit(0);
  });
