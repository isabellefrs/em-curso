# Servidor do Campus Hub

API local em JavaScript, Node.js 24.14+, Fastify e SQLite. A organização separa a montagem da aplicação (`src/app.js`) de sua execução (`src/index.js`), como a referência do minicurso de Igor Sasaki.

## Executar

Abra um terminal na pasta campus-hub/server:

```powershell
npm.cmd install
npm.cmd run dev
```

Servidor: http://127.0.0.1:3001. A interface Vite usa a porta 5175 e encaminha /api para este servidor.

## Criar seu administrador

Em outro terminal dentro de campus-hub/server:

```powershell
npm.cmd run admin:create
```

Escolha usuário (3 a 40 letras, números, ponto, hífen ou sublinhado) e senha (12 a 128 caracteres). A senha aparece como asteriscos; erros de tamanho ou confirmação podem ser corrigidos no mesmo prompt. Não envie sua senha pelo chat nem grave no código. O comando cria uma conta nova e não substitui senhas existentes.

Não há conta padrão. O banco começa vazio. O procedimento é local e não cria ou modifica contas do calendário antigo.

## API

- GET /api/health: funcionamento do servidor.
- GET /api/auth/session: administrador autenticado, quando houver, e indicação de configuração inicial.
- POST /api/auth/login: autenticação por usuário/senha.
- POST /api/auth/logout: revoga a sessão.
- GET /api/eventos: consulta pública.
- POST /api/eventos: cadastro autenticado.
- PUT /api/eventos/:id: edição autenticada.
- DELETE /api/eventos/:id: exclusão autenticada.

Escritas exigem origem autorizada e cabeçalho X-Campus-Hub: 1. As origens locais padrão são http://127.0.0.1:5175 e http://localhost:5175. Não exponha este desenvolvimento à rede: o servidor escuta apenas em 127.0.0.1.

## Persistência e autenticação

O banco fica em server/data/campus-hub.sqlite, ignorado pelo Git. Senhas usam scrypt com salt aleatório. Tokens de sessão são aleatórios, guardados como hash no banco e enviados em cookie HttpOnly / SameSite=Strict. A duração é de 8 horas. Logout revoga a sessão. O login limita tentativas por IP; o limite é em memória e reinicia com o processo.

O SQLite embutido em Node.js 24 emite aviso de recurso experimental. Foi verificado neste ambiente. Revisar runtime, HTTPS, hospedagem com disco persistente, backup, recuperação de conta e limites antes de publicar. Esta entrega é local, não uma implantação de produção.

Dados anteriores do localStorage não são removidos ou importados automaticamente. A interface autenticada permite baixar uma cópia. Ainda não há sincronização automática entre abas; use Atualizar dados.

## Testes

```powershell
npm.cmd test
```

Usam contas descartáveis, banco em memória e um arquivo temporário para verificar persistência. Não usam a conta real, a API Gemini ou e-mail.

## Assistente

GET /api/assistente/status informa o modo e a base. POST /api/assistente/perguntar recebe {pergunta}, com até 1.200 caracteres e limite de 10 consultas por IP a cada 15 minutos. Veja ../docs/PLANO_IA.md para ativar Gemini, reimportar documentos e atualizar fontes web. A consulta local funciona sem chave.

## Professores e avisos

As rotas de atendimentos, inscrições, confirmações e administração de e-mails estão implementadas. Consulte ../docs/GUIA_EMAIL_E_ADMIN.md para configuração SMTP, horário diário, histórico e comportamento em falhas. Não há envio real quando EMAIL_ENABLED=false.
