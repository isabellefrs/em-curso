# Campus Hub — entregas

## Implementado localmente

- Calendário mensal React com busca, filtro de turma, ordenação e lista de eventos.
- Administração /admin: autenticação, cadastro, edição e exclusão de eventos; SQLite e sessões revogáveis.
- Criação de administrador no terminal com asteriscos, confirmação e correção de erros de senha.
- Paleta azul/dourado/branco e favicon fornecidos pela estudante; interface responsiva.
- Assistente /assistente, base de 31 PDFs (468 páginas), transcrições de tutoriais em imagem e 3 fontes web autorizadas.
- Consulta documental local pronta, com fontes e páginas; integração Gemini implementada, pendente de chave e validação real.
- Indexação semântica opcional, atualização das fontes web, controles de escopo e testes automatizados.

Veja PLANO_IA.md para execução, ativação e limites. O site antigo não foi alterado. Não houve implantação pública.

## Nova entrega de 30/10/2026

- Código reorganizado por páginas e módulos; formatação automatizada.
- Atalhos para Moodle e SUAP na tela principal, abrindo os endereços oficiais fornecidos em novas abas.
- Limpeza de eventos por período, com prévia e proteção contra mudanças na lista.
- Cores por turma, mais dourado e favicon reenquadrado para maior presença na aba.
- Atendimento semanal de professores: cadastro/edição/exclusão, busca por nome e matéria, ícones de áreas e tabela adaptável.
- Inscrições restritas a @aluno.ifsp.edu.br, confirmação, cancelamento e gestão de cadastros.
- Lembretes 7/3/1, ciclo diário, botão manual, histórico, contagens e resumo à administração. Envio SMTP implementado, ainda não ativado com credenciais reais.

Consulte GUIA_EMAIL_E_ADMIN.md para ativação e regras operacionais.

## Ainda pendente

- A chave Gemini já foi preenchida no .env local. Falta validar respostas reais, configurar o segredo na Cloudflare e calibrar a recuperação com perguntas do campus.
- A senha SMTP já foi preenchida no .env local. Falta configurar o segredo na Cloudflare e validar a entrega real dos e-mails.
- Recuperação de conta, backup automatizado, controle de custo e preparação de hospedagem.

Dados antigos do localStorage foram preservados, sem importação automática. A administração permite baixar uma cópia. Não há sincronização automática entre abas.

## Preparação Cloudflare — 31/10/2026

- Versão Workers + D1 em cloudflare/, preservando o servidor local.
- Login Google restrito por e-mail: OAuth com PKCE, nonce, validação de assinatura e sessão revogável. Aguardando credenciais OAuth reais.
- Eventos, professores, prévia de exclusão, inscrições e histórico adaptados para D1.
- Lembretes em lotes, trava distribuída, planejamento atômico e deduplicação. Envios incertos não são repetidos automaticamente.
- Base documental importada no D1 local: 31 documentos, 3 fontes web e 797 trechos; busca textual FTS5.
- Testes: 27 servidor + 16 interface + 9 Cloudflare = 52 aprovados. Build de produção e dry-run do Worker aprovados; credenciais locais não encontradas nos artefatos verificados.
- OAuth e Gemini testados com respostas simuladas; nenhuma mensagem real enviada nesta preparação.
- Pendente: autenticar a CLI, criar D1 remoto, cadastrar OAuth/segredos, publicar prévia e medir CPU/SMTP/Gemini no plano gratuito. Backup externo automático e restauração ainda precisam ser configurados/validados.

Detalhes e passos: [guia Cloudflare](../cloudflare/README.md).
