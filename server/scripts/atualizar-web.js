import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { pastaConhecimento } from '../src/conhecimento.js';
import { fontesPermitidas, baixarFonte } from '../src/fontes-web.js';

mkdirSync(pastaConhecimento, { recursive: true });
let anterior = { documents: [], chunks: [] };
try { anterior = JSON.parse(readFileSync(pastaConhecimento + 'web.json', 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const documents = [], chunks = [], failures = [];
for (const fonte of fontesPermitidas) {
  try {
    const resultado = await baixarFonte(fonte);
    documents.push(resultado.document); chunks.push(...resultado.chunks);
    console.log('Atualizado:', fonte.url);
  } catch (e) {
    failures.push({ url: fonte.url, error: e.message });
    console.warn('Não atualizado:', fonte.url, e.message);
    const previa = anterior.documents.find(d => d.sourceUrl === fonte.url);
    if (previa) { documents.push(previa); chunks.push(...anterior.chunks.filter(c => c.documentId === previa.id)); }
  }
}
writeFileSync(pastaConhecimento + 'web.json.tmp', JSON.stringify({ documents, chunks, failures, attemptedAt: new Date().toISOString() }, null, 2));
renameSync(pastaConhecimento + 'web.json.tmp', pastaConhecimento + 'web.json');
console.log(`${documents.length} fontes disponíveis. Reinicie o servidor para carregar as atualizações.`);
if (failures.length) process.exitCode = 1;
