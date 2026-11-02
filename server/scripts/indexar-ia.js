import { writeFileSync, renameSync } from 'node:fs';
import { carregarConhecimento, pastaConhecimento } from '../src/conhecimento.js';
import { criarGemini } from '../src/assistente.js';

if (!process.env.GEMINI_API_KEY) throw new Error('Preencha GEMINI_API_KEY no arquivo server/.env antes de indexar.');
const base = carregarConhecimento();
if (!base.chunks.length) throw new Error('Importe os documentos primeiro.');
const model = process.env.EMBEDDING_MODEL || 'gemini-embedding-2';
const gemini = criarGemini(process.env.GEMINI_API_KEY);
const vectors = [];
console.log(`Indexando ${base.chunks.length} trechos. Esta operação usa a cota da API Gemini.`);
for (const [i, chunk] of base.chunks.entries()) {
  const values = await gemini.embedding(chunk.title + '\n' + chunk.text, model);
  if (values.length !== 768 || values.some(v => !Number.isFinite(v))) throw new Error('Embedding inválido; índice anterior preservado.');
  vectors.push({ id: chunk.id, values });
  if ((i + 1) % 50 === 0) console.log(`${i + 1}/${base.chunks.length}`);
}
writeFileSync(pastaConhecimento + 'vectors.json.tmp', JSON.stringify({ model, dimensions: 768, fingerprint: base.fingerprint, vectors }));
renameSync(pastaConhecimento + 'vectors.json.tmp', pastaConhecimento + 'vectors.json');
console.log('Índice pronto. Reinicie o servidor.');
