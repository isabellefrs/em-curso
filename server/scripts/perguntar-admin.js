import { input, password } from '@inquirer/prompts';

export function validarUsuario(valor) {
  return /^[a-zA-Z0-9_.-]{3,40}$/.test(valor.trim()) || 'Use de 3 a 40 letras, números, ponto, hífen ou sublinhado.';
}

export function validarSenha(valor) {
  if (valor.length < 12) return `Faltam ${12 - valor.length} caracteres. A senha precisa ter pelo menos 12.`;
  if (valor.length > 128) return 'A senha deve ter no máximo 128 caracteres.';
  return true;
}

export const configuracaoSenha = { message: 'Senha (12 a 128 caracteres):', mask: '*', toggleMask: false, validate: validarSenha };
export const configuracaoConfirmacao = senha => ({ message: 'Repita a senha:', mask: '*', toggleMask: false,
  validate: valor => valor === senha || 'As senhas não coincidem. Corrija esta confirmação e pressione Enter.' });

export async function perguntarAdmin(contexto, usuarioDisponivel = () => true) {
  const usuario = await input({
    message: 'Nome do administrador:',
    validate: valor => validarUsuario(valor) === true ? usuarioDisponivel(valor.trim()) : validarUsuario(valor),
  }, contexto);
  const senha = await password(configuracaoSenha, contexto);
  await password(configuracaoConfirmacao(senha), contexto);
  return { usuario: usuario.trim(), senha };
}
