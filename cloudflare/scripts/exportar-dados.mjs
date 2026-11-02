import { DatabaseSync } from 'node:sqlite';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const source = process.argv[2];
if (!source)
  throw new Error(
    'Informe o caminho completo do SQLite de origem. Nenhum banco será criado automaticamente.',
  );
await stat(source);
const db = new DatabaseSync(resolve(source), { readOnly: true });
const tables = {
  eventos: 'id,titulo,data,turma,descricao',
  atendimentos: 'id,professor,materia,area,dia,inicio,fim,sala,email',
  inscritos:
    'id,nome,email,turma,ativo,criado_em,confirmado_em,token_hash,token_expira,ultimo_pedido',
  saidas: 'token_hash,inscrito_id',
  execucoes: 'id,dia,origem,inicio,fim,estado,enviados,falhas,resumo',
  envios:
    'id,chave,tipo,inscrito_id,evento_id,evento_titulo,evento_data,antecedencia,estado,criado_em,enviado_em,execucao_id,detalhe',
};
const sql = [],
  counts = {};
const literal = (value) =>
  value === null
    ? 'NULL'
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : `CAST(X'${Buffer.from(String(value)).toString('hex')}' AS TEXT)`;
try {
  db.exec('BEGIN');
  for (const [table, columns] of Object.entries(tables)) {
    const rows = db.prepare(`SELECT ${columns} FROM ${table}`).all();
    counts[table] = rows.length;
    for (const row of rows)
      sql.push(
        `INSERT INTO ${table}(${columns}) VALUES(${columns
          .split(',')
          .map((c) => literal(row[c]))
          .join(',')});`,
      );
  }
  db.exec('COMMIT');
} finally {
  db.close();
}
// Após a migração, envios com resultado desconhecido não podem ser repetidos.
sql.push(
  "UPDATE envios SET estado='incerto',detalhe='Migração: confira o provedor antes de reenviar.' WHERE estado='enviando';",
);
sql.push("UPDATE execucoes SET estado='interrompida' WHERE estado='executando';");
await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
await writeFile(new URL('../.local/dados.sql', import.meta.url), sql.join('\n'), { flag: 'wx' });
console.log('Exportação local concluída (sem senhas administrativas ou sessões):', counts);
console.log(
  'Arquivo privado .local/dados.sql. Importar apenas em um D1 vazio; não publicar no Git.',
);
