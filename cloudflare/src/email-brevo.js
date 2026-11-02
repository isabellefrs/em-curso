import { emailValido } from '../../server/src/validacao.js';

const remetenteNome = 'Em Curso · 1º Info 2';

export function criarEmailBrevo(env) {
  const habilitado = env.EMAIL_ENABLED === 'true';
  const remetente = env.EMAIL_FROM?.trim();
  const adminEmail = env.ADMIN_REPORT_EMAIL?.trim();

  if (habilitado && (!env.BREVO_API_KEY || !emailValido(remetente) || !emailValido(adminEmail)))
    throw Object.assign(new Error('Configuração do Brevo incompleta.'), { code: 'BREVO_CONFIG' });

  const url = new URL(env.PUBLIC_URL || 'https://example.invalid');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (env.NODE_ENV === 'production' && url.protocol !== 'https:')
  )
    throw Object.assign(new Error('PUBLIC_URL inválida.'), { code: 'EMAIL_PUBLIC_URL' });

  return {
    habilitado,
    siteUrl: url.origin,
    adminEmail,
    async enviar({ to, subject, text, id }) {
      if (!habilitado) throw Object.assign(new Error('Envio de e-mail desativado.'), { code: 'EMAIL_DISABLED' });
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: remetenteNome, email: remetente },
          to: [{ email: to }],
          subject,
          textContent: text,
          tags: ['campus-hub'],
          headers: id ? { 'X-Campus-Hub-Message-Id': id } : undefined,
        }),
        signal: AbortSignal.timeout(20000),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const apiCode = typeof result.code === 'string' && /^[a-z0-9_-]{1,40}$/i.test(result.code)
          ? result.code.toUpperCase()
          : `HTTP_${response.status}`;
        throw Object.assign(new Error('A API do Brevo recusou o envio.'), {
          code: `BREVO_${apiCode}`,
          responseCode: response.status,
          command: 'API',
        });
      }
      if (typeof result.messageId !== 'string' || !result.messageId)
        throw Object.assign(new Error('O Brevo não confirmou o aceite da mensagem.'), {
          code: 'BREVO_NO_MESSAGE_ID',
          responseCode: response.status,
          command: 'API',
        });
      return { accepted: [to], rejected: [], messageId: result.messageId };
    },
    fechar() {},
  };
}
