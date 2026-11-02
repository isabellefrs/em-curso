import { readFile, readdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
async function envFile(url) {
  try {
    return parseEnv(await readFile(url, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}
const env = {
  ...(await envFile(new URL('../../server/.env', import.meta.url))),
  ...(await envFile(new URL('../.dev.vars', import.meta.url))),
};
const names = ['GEMINI_API_KEY', 'BREVO_API_KEY', 'ADMIN_PASSWORD'];
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? files(new URL(e.name + '/', dir)) : [new URL(e.name, dir)],
    ),
  );
  return nested.flat();
}
let count = 0;
for (const dir of [
  new URL('../.build/', import.meta.url),
  new URL('../../client/dist/', import.meta.url),
]) {
  for (const file of await files(dir)) {
    if (!/\.(js|mjs|html|css|json|map|txt)$/.test(file.pathname)) continue;
    const data = await readFile(file, 'utf8');
    count++;
    for (const name of names) {
      if (env[name]?.length > 5 && data.includes(env[name]))
        throw new Error(
          `${name} encontrada no artefato. Publicação bloqueada; o valor não foi exibido.`,
        );
    }
  }
}
console.log(
  `Verificação concluída em ${count} arquivos: valores das credenciais locais não encontrados nos artefatos.`,
);
