import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const local = parseEnv(await readFile(new URL('../../server/.env', import.meta.url), 'utf8'));
for (const name of ['GEMINI_API_KEY', 'BREVO_API_KEY'])
  console.log(`${name}: ${local[name]?.trim() ? 'preenchida' : 'ausente'}`);
console.log(
  `E-mail no servidor local: ${local.EMAIL_ENABLED === 'true' ? 'habilitado' : 'desabilitado'}`,
);
console.log('Valores ocultos. O .env não é copiado nem publicado por este script.');
console.log(
  'No Worker, configure PUBLIC_URL, EMAIL_PROVIDER=brevo, EMAIL_FROM e os segredos ADMIN_USERNAME, ADMIN_PASSWORD, GEMINI_API_KEY e BREVO_API_KEY. Os avisos ficam indisponíveis até a chave e o remetente serem configurados.',
);
