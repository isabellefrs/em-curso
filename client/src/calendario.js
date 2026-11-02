export function mesAtual() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valores.year}-${valores.month}`;
}

// UTC é usado somente para os cálculos de calendário, sem converter eventos.
export function mudarMes(mes, deslocamento) {
  const [ano, numero] = mes.split('-').map(Number);
  const data = new Date(Date.UTC(ano, numero - 1 + deslocamento, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function tituloMes(mes) {
  const [ano, numero] = mes.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(ano, numero - 1, 1)));
}

export function diasDoMes(mes) {
  const [ano, numero] = mes.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, numero - 1, 1)).getUTCDay();
  const quantidade = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  const tamanho = Math.ceil((inicio + quantidade) / 7) * 7;
  return Array.from({ length: tamanho }, (_, indice) => {
    const dia = indice - inicio + 1;
    return dia < 1 || dia > quantidade ? null : `${mes}-${String(dia).padStart(2, '0')}`;
  });
}

export function eventosDoMes(eventos, mes) {
  return eventos.filter((evento) => evento.data.startsWith(`${mes}-`));
}
