// Padroniza os textos apenas para comparação; o título exibido não muda.
export function normalizarTexto(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function selecionarEventos(eventos, turma, busca, ordem) {
  const termo = normalizarTexto(busca);

  // filter cria uma nova lista, então sort não altera os dados originais.
  return eventos
    .filter((evento) => {
      const correspondeTurma =
        turma === 'todas' || evento.turma === turma || evento.turma === 'geral';
      const correspondeBusca = normalizarTexto(evento.titulo).includes(termo);
      return correspondeTurma && correspondeBusca;
    })
    .sort((a, b) => {
      const comparacao = a.data.localeCompare(b.data);
      return ordem === 'decrescente' ? -comparacao : comparacao;
    });
}

export function formatarData(data) {
  return data.split('-').reverse().join('/');
}

export function atualizarEvento(eventos, id, dados) {
  return eventos.map((evento) => (evento.id === id ? { ...evento, ...dados, id } : evento));
}

export function removerEvento(eventos, id) {
  return eventos.filter((evento) => evento.id !== id);
}
