import { abrirBanco } from '../src/banco.js';
import { criarAdministrador } from '../src/autenticacao.js';
import { perguntarAdmin } from './perguntar-admin.js';

let db;
try {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Execute este comando no terminal integrado do VS Code (Terminal > Novo Terminal).');
  }
  console.log('Os asteriscos confirmam a digitação sem mostrar sua senha. Use pelo menos 12 caracteres.');
  db = abrirBanco();
  const { usuario, senha } = await perguntarAdmin(undefined, usuario =>
    !db.prepare('SELECT id FROM administradores WHERE usuario=?').get(usuario) || 'Este usuário já existe. Use outro nome; a senha existente não será alterada.'
  );
  await criarAdministrador(db, usuario, senha);
  console.log('Administrador criado. Entre pela página /admin.');
} catch (error) {
  console.error(error.name === 'ExitPromptError' ? 'Cadastro cancelado. Nenhuma conta foi criada.' : error.message);
  process.exitCode = 1;
} finally {
  db?.close();
}
