export const turmas = { geral: 'Todas as turmas', turma_a: 'Turma A', turma_b: 'Turma B' };
export const diasSemana = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
export const areas = {
  exatas: ['∑', 'Exatas'],
  humanas: ['🏛', 'Humanas'],
  sociais: ['⚖', 'Sociais'],
  natureza: ['⚗', 'Natureza'],
  linguagens: ['Aa', 'Linguagens'],
  tecnologia: ['⌘', 'Tecnologia'],
  outras: ['✦', 'Outras áreas'],
};
export const normalizarBusca = (valor) =>
  valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
export const dataHora = (valor) =>
  valor ? new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
export function filtrarAtendimentos(lista, nome, materia) {
  return lista.filter(
    (a) =>
      normalizarBusca(a.professor).includes(normalizarBusca(nome)) &&
      normalizarBusca(a.materia).includes(normalizarBusca(materia)),
  );
}
