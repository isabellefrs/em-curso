export const erroHttp = (mensagem, statusCode = 400) =>
  Object.assign(new Error(mensagem), { statusCode, publico: true });
export const objeto = (properties) => ({
  type: 'object',
  required: Object.keys(properties),
  additionalProperties: false,
  properties,
});
export const texto = (maxLength, minLength = 1) => ({ type: 'string', minLength, maxLength });
export const dataSchema = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
export function validarData(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < '2000-01-01' || data > '2100-12-31')
    throw erroHttp('Informe uma data válida entre 2000 e 2100.');
  const [ano, mes, dia] = data.split('-').map(Number);
  if (new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10) !== data)
    throw erroHttp('Data inválida.');
  return data;
}
export function validarPeriodo({ inicio, fim }) {
  validarData(inicio);
  validarData(fim);
  if (inicio > fim) throw erroHttp('A data inicial deve ser anterior ou igual à final.');
}
export const emailValido = (email) =>
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email) &&
  email.length <= 254;
export function emailEstudantil(valor) {
  const email = valor.trim().toLowerCase();
  if (!emailValido(email) || email.split('@')[1] !== 'aluno.ifsp.edu.br')
    throw erroHttp('Use seu e-mail @aluno.ifsp.edu.br.');
  return email;
}
