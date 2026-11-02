export const CHAVE_EVENTOS = 'campus-hub:eventos:v1';

function eventoValido(evento) {
  if (!evento || typeof evento !== 'object') return false;
  const idValido =
    (typeof evento.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(evento.id)) ||
    (Number.isSafeInteger(evento.id) && evento.id > 0);
  if (
    !idValido ||
    typeof evento.titulo !== 'string' ||
    !evento.titulo.trim() ||
    evento.titulo.length > 120
  )
    return false;
  if (!['geral', 'turma_a', 'turma_b'].includes(evento.turma)) return false;
  if (typeof evento.descricao !== 'string' || evento.descricao.length > 1000) return false;
  if (
    typeof evento.data !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(evento.data) ||
    evento.data < '2000-01-01' ||
    evento.data > '2100-12-31'
  )
    return false;
  const [ano, mes, dia] = evento.data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10) === evento.data;
}

export function carregarEventos(storage, iniciais) {
  try {
    const texto = storage.getItem(CHAVE_EVENTOS);
    if (texto === null) return { eventos: iniciais, aviso: '' };
    const salvos = JSON.parse(texto);
    if (
      !Array.isArray(salvos) ||
      !salvos.every(eventoValido) ||
      new Set(salvos.map((e) => String(e.id))).size !== salvos.length
    )
      throw new Error('Dados inválidos');
    return { eventos: salvos, aviso: '' };
  } catch {
    return {
      eventos: iniciais,
      aviso:
        'Não foi possível ler os eventos locais. Exibindo os exemplos. Uma nova alteração tentará salvar a lista exibida.',
    };
  }
}

export function salvarEventos(storage, eventos) {
  try {
    storage.setItem(CHAVE_EVENTOS, JSON.stringify(eventos));
    return true;
  } catch {
    return false;
  }
}

// O acesso ao próprio localStorage também pode ser bloqueado pelo navegador.
export const armazenamentoDoNavegador = {
  getItem: (chave) => window.localStorage.getItem(chave),
  setItem: (chave, valor) => window.localStorage.setItem(chave, valor),
};
