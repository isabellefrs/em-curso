export const normalizar = (texto) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
const ignoradas = new Set(
  'a o os as um uma de da do das dos e em no na nos nas para por com que qual quais como quero preciso posso sobre me meu minha eu se ao ou ser ter mais fazer esta este isso voce favor campus ifsp araraquara ano primeiro primeira segundo segunda terceiro terceira quarto quarta serie aprender aprende aprenderia aprenderei'.split(
    ' ',
  ),
);
export const termos = (texto) =>
  [...new Set(normalizar(texto).match(/[a-z0-9]{3,}/g) || [])].filter((t) => !ignoradas.has(t));

export function ehConsultaCurricular(pergunta) {
  const p = normalizar(pergunta);
  const termoCurricular =
    /\bmatriz curricular\b|\bgrade curricular\b|\bcurriculo\b|\bcomponentes curriculares\b|\bdisciplinas?\b|\bconteudo programatico\b/.test(
      p,
    );
  const anoEscolar =
    /\b[1-4]\s*[º°o]?\s*ano\b|\b(?:primeiro|segundo|terceiro|quarto)\s+ano\b|\b[1-4]\s*[ªa]?\s+serie\b/.test(
      p,
    );
  return termoCurricular || (anoEscolar && /\b(?:if|ifsp|araraquara|campus|curso)\b/.test(p));
}

export function buscarTrechos(base, pergunta, limite = 5, tipo = 'campus') {
  const curricular = ehConsultaCurricular(pergunta);
  const palavras = termos(pergunta);
  if (curricular) {
    const p = normalizar(pergunta);
    const cursoInformatica = /\b(?:informatica|computacao|programacao|info\s*\d?)\b/.test(p);
    palavras.push(...(cursoInformatica ? ['informatica'] : []));
    palavras.push(
      'matriz',
      'curricular',
      'programacao',
      'computadores',
      'computacao',
      'interfaces',
    );
  }
  const consulta = [...new Set(palavras)];
  if (!consulta.length) return [];
  let candidatos = base.chunks.filter((c) =>
    tipo === 'campus' ? c.topic !== 'study' : c.topic === 'study',
  );
  if (curricular) {
    const p = normalizar(pergunta);
    const mecanica = /\bmecanica\b/.test(p);
    candidatos = candidatos.filter((c) => {
      const titulo = normalizar(c.title);
      if (!/matriz curricular|projeto pedagogico/.test(titulo)) return false;
      if (mecanica) return /mecanica/.test(titulo);
      return /informatica/.test(titulo);
    });
    if (!candidatos.length) return [];
  }
  const freq = new Map(
    consulta.map((p) => [
      p,
      candidatos.filter((c) => termos(c.text + ' ' + c.title).includes(p)).length,
    ]),
  );
  const resultados = candidatos
    .map((chunk) => {
      const corpo = termos(chunk.text),
        titulo = termos(chunk.title);
      const encontrados = consulta.filter((p) => corpo.includes(p) || titulo.includes(p));
      const score = encontrados.reduce(
        (s, p) =>
          s + Math.log(1 + candidatos.length / (1 + freq.get(p))) * (titulo.includes(p) ? 2 : 1),
        0,
      );
      return { ...chunk, score, cobertura: encontrados.length / palavras.length };
    })
    .filter((c) => c.score > 0 && c.cobertura >= Math.min(0.5, 2 / consulta.length))
    .sort((a, b) => b.score - a.score);
  // Evita que trechos sobrepostos da mesma página dominem a resposta.
  const paginas = new Set();
  return resultados
    .filter((c) => {
      const chave = `${c.documentId}:${c.page ?? c.id}`;
      if (paginas.has(chave)) return false;
      paginas.add(chave);
      return true;
    })
    .slice(0, limite);
}

export function cosseno(a, b) {
  if (a.length !== b.length || !a.length) return 0;
  const norma = Math.hypot(...a) * Math.hypot(...b);
  return norma ? a.reduce((s, v, i) => s + v * b[i], 0) / norma : 0;
}

export function fontePublica(chunk, numero) {
  return {
    numero,
    titulo: chunk.title.replaceAll('_', ' '),
    pagina: chunk.page || null,
    url: chunk.url || null,
    consultadoEm: chunk.fetchedAt || null,
    trecho: chunk.text,
    transcricaoVisual: chunk.extraction === 'visual-reviewed',
  };
}
