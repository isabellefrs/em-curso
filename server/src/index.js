import { abrirBanco } from './banco.js';
import { buildApp } from './app.js';
import { carregarConhecimento } from './conhecimento.js';
import { criarAssistente, criarGemini } from './assistente.js';
import { criarEmail } from './email.js';
import { criarNotificacoes } from './notificacoes.js';
import { iniciarAgendador } from './agendador.js';

const db = abrirBanco();
const origins = (process.env.APP_ORIGINS || 'http://127.0.0.1:5175,http://localhost:5175')
  .split(',')
  .map((valor) => valor.trim());
const assistente = criarAssistente({
  base: carregarConhecimento(),
  gemini: process.env.GEMINI_API_KEY ? criarGemini(process.env.GEMINI_API_KEY) : null,
});
const email = criarEmail();
const notificacoes = criarNotificacoes({ db, email });
// O processo anterior pode ter encerrado sem receber a confirmação do SMTP.
db.exec(
  "UPDATE envios SET estado='incerto',detalhe='Processo interrompido; confira o provedor.' WHERE estado='enviando'; UPDATE execucoes SET estado='interrompida' WHERE estado='executando'",
);
const app = await buildApp({
  db,
  assistente,
  notificacoes,
  origins,
  secureCookie: process.env.NODE_ENV === 'production',
});
let pararAgendador;
app.addHook('onClose', async () => {
  pararAgendador?.();
  await notificacoes.aguardar();
  email.fechar();
  db.close();
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
try {
  await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT || 3001) });
  pararAgendador = iniciarAgendador({
    db,
    notificacoes,
    hora: Number(process.env.REMINDER_HOUR || 8),
  });
  console.log('Servidor Em Curso disponível em http://127.0.0.1:' + (process.env.PORT || 3001));
} catch (error) {
  console.error('Não foi possível iniciar o servidor:', error.message);
  await app.close();
  process.exitCode = 1;
}
