import { diaLocal } from './notificacoes.js';

// Um único processo deve hospedar a rotina. Repetições manuais usam a mesma deduplicação do banco.
export function iniciarAgendador({ db, notificacoes, hora = 8, agora = Date.now }) {
  if (!Number.isInteger(hora) || hora < 0 || hora > 23)
    throw new Error('REMINDER_HOUR deve estar entre 0 e 23.');
  function verificar() {
    const hoje = diaLocal(agora());
    const horaLocal = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(agora())),
    );
    const estado = notificacoes.painel();
    if (!estado.habilitado || estado.executando || horaLocal < hora) return;
    if (db.prepare("SELECT id FROM execucoes WHERE dia=? AND origem='automatica'").get(hoje))
      return;
    notificacoes.iniciar('automatica');
  }
  const timer = setInterval(verificar, 60000);
  timer.unref();
  verificar();
  return () => clearInterval(timer);
}
