import nodemailer from 'nodemailer';
import { emailValido } from './validacao.js';

export function criarEmail(env = process.env) {
  const habilitado = env.EMAIL_ENABLED === 'true';
  const siteUrl = (env.PUBLIC_URL || 'http://127.0.0.1:5175').replace(/\/$/, '');
  const remetente = env.SMTP_USER || 'sala@example.com';
  const adminEmail = env.ADMIN_REPORT_EMAIL || 'admin@example.com';
  if (habilitado && (!env.SMTP_PASSWORD || !emailValido(remetente) || !emailValido(adminEmail)))
    throw new Error(
      'Configure SMTP_USER, SMTP_PASSWORD e ADMIN_REPORT_EMAIL antes de habilitar e-mails.',
    );
  const url = new URL(siteUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('PUBLIC_URL deve ser a origem do site, sem caminho ou credenciais.');
  if (env.NODE_ENV === 'production' && url.protocol !== 'https:')
    throw new Error('PUBLIC_URL deve usar HTTPS em produção.');
  const transporter = habilitado
    ? nodemailer.createTransport({
        host: env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(env.SMTP_PORT || 465),
        secure: Number(env.SMTP_PORT || 465) === 465,
        requireTLS: true,
        auth: { user: remetente, pass: env.SMTP_PASSWORD },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
        disableFileAccess: true,
        disableUrlAccess: true,
        logger: false,
        debug: false,
      })
    : null;
  return {
    habilitado,
    siteUrl,
    adminEmail,
    async enviar({ to, subject, text, id }) {
      if (!transporter) throw new Error('E-mail não configurado.');
      const resultado = await transporter.sendMail({
        from: { name: 'Em Curso · 1º Info 2', address: remetente },
        to,
        subject,
        text,
        messageId: `<${id}@campus-hub.local>`,
      });
      if (!resultado.accepted?.length || resultado.rejected?.length)
        throw new Error('Destinatário não aceito pelo SMTP.');
    },
    fechar() {
      transporter?.close();
    },
  };
}
