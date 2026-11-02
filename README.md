# Campus Hub

Projeto educacional para organizar calendário, atendimentos docentes, avisos por e-mail e consultas com IA para estudantes do IFSP Araraquara. Não é um canal oficial do IFSP.

O repositório se chama `campus-hub` por enquanto. O nome do repositório pode ser alterado depois sem mudar o nome exibido no site nem a hospedagem.

## Estrutura

- `client/`: interface React e Vite.
- `cloudflare/`: Worker da API, migrações D1, envio por Brevo e integração com Gemini.
- `server/`: versão local Fastify/SQLite e utilitários de preparação documental.
- `docs/`: guias e capturas de prévia.

## Desenvolvimento

Instale as dependências em `client/`, `server/` e `cloudflare/` com `npm.cmd ci`. Para compilar a interface e validar o pacote de produção da Cloudflare, rode em `cloudflare/`:

```powershell
npm.cmd run build
```

Para executar a versão local Fastify, configure `server/.env` usando `server/.env.example` e siga `server/README.md`. Para prévia local da Cloudflare, copie `cloudflare/.dev.vars.example` para `cloudflare/.dev.vars` e siga `cloudflare/README.md`.

## Hospedagem e dados

A versão pública usa Cloudflare Workers com D1. O endereço atual pode ser diferente conforme a configuração da conta; o nome do repositório GitHub não determina a URL pública do site.

Por segurança, o repositório não inclui credenciais, configuração real do Wrangler, banco SQLite ou documentos importados para a base da IA. Os PDFs e o corpus local devem ser obtidos e usados apenas com autorização. Os exemplos de configuração usam valores fictícios; configure segredos no ambiente local ou no painel do provedor.

## Referência de estudo

[Minicurso de IA com Node.js — Igor Sasaki](https://github.com/IgorSasaki/minicurso-ia-node-ifsp).
