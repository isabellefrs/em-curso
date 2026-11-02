// Exclusivamente carregado pelo teste Miniflare; não é o entrypoint publicável.
import { hashSenha, verificarSenha, hashToken } from '../../server/src/autenticacao.js';
import { criarEmail } from '../../server/src/email.js';
import { GoogleGenAI } from '../../server/node_modules/@google/genai/dist/web/index.mjs';

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/crypto') {
      const senha = 'senha-ficticia-exclusiva-do-teste';
      const armazenada = await hashSenha(senha);
      return Response.json({
        correta: await verificarSenha(senha, armazenada),
        incorreta: await verificarSenha('outra-senha-ficticia', armazenada),
        tokenHash: hashToken('token-ficticio').length,
      });
    }
    if (path === '/email') {
      // Construção do transporte e configuração TLS; não envia nem autentica.
      const email = criarEmail({
        EMAIL_ENABLED: 'true',
        SMTP_USER: 'exemplo@example.test',
        SMTP_PASSWORD: 'credencial-ficticia',
        ADMIN_REPORT_EMAIL: 'admin@example.test',
        PUBLIC_URL: 'https://example.test',
        NODE_ENV: 'production',
      });
      email.fechar();
      return Response.json({ habilitado: email.habilitado, envioReal: false });
    }
    if (path === '/gemini') {
      const ai = new GoogleGenAI({
        apiKey: 'chave-ficticia',
        httpOptions: { retryOptions: { attempts: 1 } },
      });
      const resposta = await ai.models.generateContent({
        model: 'modelo-ficticio',
        contents: 'teste',
      });
      return Response.json({ texto: resposta.text });
    }
    return new Response('not found', { status: 404 });
  },
};
