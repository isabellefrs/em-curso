import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt);
const opcoes = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export async function hashSenha(senha) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derivar(senha, salt, 64, opcoes);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verificarSenha(senha, armazenada) {
  const [salt, hash] = armazenada.split(':');
  const calculado = await derivar(senha, salt, 64, opcoes);
  const esperado = Buffer.from(hash, 'hex');
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}

export async function criarAdministrador(db, usuario, senha) {
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(usuario))
    throw new Error('Usuário: 3 a 40 letras, números, ponto, hífen ou sublinhado.');
  if (senha.length < 12 || senha.length > 128)
    throw new Error('A senha deve ter entre 12 e 128 caracteres.');
  if (db.prepare('SELECT id FROM administradores WHERE usuario=?').get(usuario))
    throw new Error('Este usuário já existe. Nenhuma senha foi alterada.');
  db.prepare('INSERT INTO administradores(usuario,senha_hash) VALUES (?,?)').run(
    usuario,
    await hashSenha(senha),
  );
}

export function criarSessao(db, adminId, agora) {
  const token = randomBytes(32).toString('hex');
  const expira = agora + 8 * 60 * 60 * 1000;
  db.prepare('DELETE FROM sessoes WHERE expira_em <= ?').run(agora);
  db.prepare('INSERT INTO sessoes(token_hash,admin_id,expira_em) VALUES (?,?,?)').run(
    hashToken(token),
    adminId,
    expira,
  );
  return token;
}

export function lerSessao(db, token, agora) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    db
      .prepare(
        `SELECT a.id, a.usuario FROM sessoes s JOIN administradores a ON a.id=s.admin_id
    WHERE s.token_hash=? AND s.expira_em>?`,
      )
      .get(hashToken(token), agora) || null
  );
}
