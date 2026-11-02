import { mkdir, writeFile } from 'node:fs/promises';
import { carregarConhecimento } from '../../server/src/conhecimento.js';
const base = carregarConhecimento();
if (!base.chunks.length)
  throw new Error('Base documental vazia. Confira server/data/knowledge antes de publicar.');
const quote = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const sql = [
  'DELETE FROM conhecimento;',
  'DELETE FROM conhecimento_fts;',
  'DELETE FROM conhecimento_meta;',
];
for (const c of base.chunks) {
  sql.push(
    `INSERT INTO conhecimento VALUES(${quote(c.id)},${quote(c.topic || 'campus')},${quote(JSON.stringify(c))});`,
  );
  sql.push(
    `INSERT INTO conhecimento_fts(id,texto) VALUES(${quote(c.id)},${quote(c.title + ' ' + c.text)});`,
  );
}
const meta = {
  documentos: base.documents.filter((d) => d.kind === 'document').length,
  paginas: base.documents.reduce((n, d) => n + (d.pages || 0), 0),
  fontesWeb: base.documents.filter((d) => d.kind === 'web').length,
  trechos: base.chunks.length,
  paginasComExtracaoLimitada: base.warnings.filter((w) => !w.reviewed).length,
};
sql.push(`INSERT INTO conhecimento_meta VALUES(1,${quote(JSON.stringify(meta))});`);
await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
await writeFile(new URL('../.local/conhecimento.sql', import.meta.url), sql.join('\n'));
console.log(
  `Base preparada: ${meta.documentos} documentos, ${meta.fontesWeb} fontes web, ${meta.trechos} trechos. Nenhuma credencial incluída.`,
);
