# Campus Hub

Projeto educacional de uma plataforma escolar com calendário, informações de atendimento docente e assistente de IA fundamentado em documentos oficiais do IFSP Araraquara.

## Decisões confirmadas

- Nome oficial: Campus Hub; identificador para o projeto: `campus-hub`.
- Implementação nova, escrita do zero. O calendário anterior serve como referência de comportamento e regras de negócio.
- Desenvolvimento em entregas maiores, com implementação completa seguida de explicação, conforme preferência atual da estudante.
- Preservar a aplicação publicada durante a construção da nova versão.
- Base local: React/JavaScript/Vite na interface e Fastify/SQLite no servidor. Hospedagem e preparação de produção ainda serão discutidas.

## Referências

- `classroom_calendar.zip`: código do calendário anterior, fornecido pela estudante.
- Histórico técnico do calendário e resumo `CONTEXTO_COMPLETO_CALENDARIO_IA_PARA_CODEX.md`.
- [Minicurso de IA com Node.js — Igor Sasaki](https://github.com/IgorSasaki/minicurso-ia-node-ifsp): referência de estudo para integração com Gemini e busca em documentos (RAG).

Esses materiais são referências; suas recomendações não representam automaticamente decisões do Campus Hub. A inspeção inicial não equivale a uma auditoria completa ou à execução dos testes dos projetos antigos.

## Etapas propostas para discussão

1. Definir os dados e as regras de um evento escolar, com exemplos fictícios.
2. Construir uma primeira consulta de eventos, com filtro por turma.
3. Adicionar persistência e administração autenticada.
4. Desenvolver atendimento docente e notificações por e-mail.
5. Integrar perguntas sobre documentos oficiais, com indicação de fontes e resposta de ausência de informação quando necessário.

A ordem e o escopo podem mudar conforme as decisões de produto. O estado atual está em docs/ENTREGAS.md.

## Regras observadas no calendário anterior

- Eventos possuem título, data, descrição opcional e público: geral, turma A ou turma B.
- A data do evento representa um dia do calendário, sem horário obrigatório.
- A rotina de lembretes define antecedências de 7, 3 e 1 dia. Há um comentário divergente no schema de preferências; a política da nova versão precisa ser definida explicitamente.
- Há contas administrativas, sessões, inscrições por e-mail e confirmação de endereço.

Essas observações ajudam a formular requisitos; não obrigam a repetir o modelo de dados antigo.

## Ambiente verificado em 28/10/2026

- Windows / PowerShell.
- Node.js: `24.14.1`.
- npm: `11.12.1`.
- Git: `2.56.0.windows.4`.
- pnpm não encontrado no PATH deste terminal.

A interface usa React/JavaScript/Vite; o servidor usa Fastify, SQLite e autenticação administrativa. Consulte client/README.md, server/README.md e docs/ENTREGAS.md para executar e acompanhar. O assistente foi implementado em /assistente, com consulta local ativa. A geração Gemini depende da chave em server/.env. Veja docs/PLANO_IA.md para ativação, fontes e limites.



## Administração, professores e avisos

Consulte [o guia de e-mail e administração](docs/GUIA_EMAIL_E_ADMIN.md) para as novas funções, organização do código, validação e ativação do SMTP. O envio real depende da configuração local da conta da turma e de um endereço público para os links dos alunos.

## Preparação Cloudflare

A versão Workers + D1 e o login Google estão em preparação, sem publicação. Consulte [o guia da migração](cloudflare/README.md) para testes, configuração e pendências. A versão local continua disponível.
