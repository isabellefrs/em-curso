import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const pastaConhecimento = fileURLToPath(new URL('../data/knowledge/', import.meta.url));
export { normalizar, termos, buscarTrechos, cosseno, fontePublica } from './conhecimento-core.js';

function ler(nome, padrao) {
  try {
    return JSON.parse(readFileSync(pastaConhecimento + nome, 'utf8'));
  } catch (erro) {
    if (erro.code === 'ENOENT') return padrao;
    throw erro;
  }
}
export function carregarConhecimento() {
  const local = ler('corpus.json', { documents: [], chunks: [], warnings: [] });
  const web = ler('web.json', { documents: [], chunks: [] });
  const base = {
    documents: [...local.documents, ...web.documents],
    chunks: [...local.chunks, ...web.chunks],
    warnings: local.warnings || [],
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(base.chunks)).digest('hex');
  const indice = ler('vectors.json', null);
  const valido =
    indice?.fingerprint === fingerprint &&
    typeof indice.model === 'string' &&
    indice.dimensions === 768 &&
    Array.isArray(indice.vectors) &&
    indice.vectors.length === base.chunks.length &&
    new Set(indice.vectors.map((v) => v.id)).size === base.chunks.length &&
    indice.vectors.every(
      (v) =>
        base.chunks.some((c) => c.id === v.id) &&
        Array.isArray(v.values) &&
        v.values.length === 768 &&
        v.values.every(Number.isFinite),
    );
  return { ...base, fingerprint, indice: valido ? indice : null };
}
