# Em Curso — versão Cloudflare

Esta pasta contém a adaptação para Workers + D1. A versão Fastify/SQLite em `../server` continua disponível. Os testes usam dados fictícios e não leem `.env`.

## Estado em 01/11/2026

- API de eventos, professores, inscrições, administração e assistente adaptada para D1.
- Login administrativo por usuário e senha configurados como segredos do Worker. A senha não fica no código nem no banco; as sessões usam tokens aleatórios armazenados como hashes.
- Sessões são revogáveis e seus tokens são armazenados somente como hashes.
- Prévia de exclusão usa uma versão dos eventos. O lote só é excluído se a versão continuar válida; alterações simultâneas invalidam a prévia.
- Busca documental usa índice textual FTS5 no D1, com os mesmos controles de escopo e citações do assistente existente. Os embeddings opcionais do servidor local não são usados nesta versão.
- Agendamento a cada minuto, no fuso de São Paulo. Depois das 8h, planeja uma execução automática diária. Processa até três lembretes por chamada; o botão manual começa a fila imediatamente, que pode continuar nos ciclos seguintes.
- E-mails transacionais do Worker usam a API HTTPS do Brevo; a configuração de produção permanece desabilitada até a chave da API e o remetente serem verificados.
- O Worker de produção usa `workers.dev`; confirmação de aceite do Brevo não comprova entrega na caixa de entrada.

## Verificar localmente

Execute nesta pasta:
npm.cmd ci

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run check:secrets
npm.cmd run knowledge:prepare
npm.cmd run db:local
npm.cmd exec wrangler -- d1 execute campus-hub --local --file=.local/conhecimento.sql
npm.cmd run dev
```

As dependências de `../server` e `../client` também devem estar instaladas (`npm.cmd ci` em cada pasta). O build compila o React e faz apenas `deploy --dry-run`, sem publicar.

Para prévia local, copie `.dev.vars.example` para `.dev.vars` e informe as credenciais apenas nesse arquivo ignorado pelo Git. Mantenha `EMAIL_ENABLED=false` até a chave e o remetente Brevo estarem verificados.

## Configurar a conta e o login administrativo

1. Autenticar o terminal pelo fluxo oficial `npm.cmd exec wrangler -- login`. A pessoa dona da conta conclui a autenticação no navegador.
2. Copiar `wrangler.example.jsonc` para `wrangler.jsonc`, criar um banco D1 gratuito chamado `campus-hub` e colocar o ID retornado no arquivo local.
3. A configuração usa o Worker `em-curso`. Com o subdomínio de conta `emcurso-arq`, a URL pública fica `https://em-curso.emcurso-arq.workers.dev`.
4. Definir `PUBLIC_URL` como a origem HTTPS exata do Worker, sem barra final. Os links de confirmação e cancelamento de e-mail usam essa origem.
5. Escolher um nome de usuário administrativo e uma senha nova, exclusiva e com 12 a 128 caracteres. Não reutilizar a senha antiga do projeto.
6. Cadastrar `ADMIN_USERNAME` e `ADMIN_PASSWORD` como segredos do Worker usando `npm.cmd exec wrangler -- secret put NOME_DA_VARIAVEL`. O Wrangler pedirá cada valor sem colocá-lo no histórico do terminal. Não digitar esses valores no código, no `.env` versionado, em commits ou mensagens.
7. No Brevo, ativar o envio transacional, registrar e verificar o remetente definido em `EMAIL_FROM` e gerar uma API key. Um remetente `@gmail.com` pode ser substituído pelo domínio de envio do Brevo; autenticar um domínio próprio melhora o alinhamento e a entrega.
8. Cadastrar `BREVO_API_KEY` como segredo com `npm.cmd exec wrangler -- secret put BREVO_API_KEY`. O valor é digitado no prompt, nunca em comandos, commits ou mensagens. Depois de confirmar no painel Brevo que o remetente está verificado, configurar `EMAIL_ENABLED=true` e publicar.

Variáveis necessárias: `PUBLIC_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `GEMINI_API_KEY`, `EMAIL_PROVIDER=brevo`, `EMAIL_FROM`, `ADMIN_REPORT_EMAIL`, `EMAIL_ENABLED` e o segredo `BREVO_API_KEY`. A API usa HTTPS e não precisa da senha de app do Gmail. O plano gratuito Brevo anuncia 300 envios por dia e não tem limite de duração; limites e disponibilidade podem mudar. Aceite da API não garante entrega final.

## Migrar dados e documentos

Não existe importação automática do banco antigo. A cópia de projeto movida para `Documents` pode não conter o SQLite, que permaneceu na pasta anterior do OneDrive. Escolha explicitamente a origem correta.

```powershell
npm.cmd run data:export -- "CAMINHO_COMPLETO_DO_BANCO.sqlite"
```

O exportador abre o banco somente para leitura e grava `.local/dados.sql` sem sobrescrever uma exportação anterior. Inclui eventos, professores, inscritos, links de cancelamento e histórico; não exporta senhas administrativas ou sessões. O arquivo contém dados pessoais: manter privado. Importar apenas no D1 novo/vazio, depois das migrações. Faça backup antes de qualquer importação em banco existente.

Documentos: `knowledge:prepare` gera `.local/conhecimento.sql` a partir de `server/data/knowledge`. A versão de busca textual preserva as páginas, fontes e restrições do projeto. O arquivo atualiza apenas as tabelas documentais. Se o comando remoto for interrompido, não considerar a base pronta até conferir a contagem e repetir a importação completa.

## Antes de liberar para a turma

- Aplicar as migrações no D1 remoto e importar a base documental; conferir contagens.
- Cadastrar os segredos no Worker e validar o login com a conta permitida e a rejeição de outra conta.
- Testar uma pergunta com fonte e uma pergunta fora do escopo usando o Gemini real.
- Validar primeiro a API Brevo, confirmação, cancelamento e lembrete com destinatários de teste autorizados. Não ativar disparos para cadastros importados antes disso.
- Conferir CPU e subrequests nos indicadores da Cloudflare. Miniflare não comprova respeito ao limite de CPU do plano gratuito. O login usa comparação de hash; IA e API de e-mail ainda precisam ser medidas na nuvem.
- Testar backup/exportação do D1 e restauração em outro banco. Backup automático externo ainda não foi configurado.
- Confirmar estabilidade da fila: o cron não garante execução em um segundo exato. Links expirados, falhas de SMTP e envios incertos aparecem no histórico; não há reenvio automático de mensagens com resultado incerto.

As contas externas, cotas, disponibilidade do Gemini e aceitação do Brevo continuam sujeitos aos respectivos provedores. Nada nesta preparação contrata plano pago ou garante hospedagem vitalícia.

Referências: [Workers](https://developers.cloudflare.com/workers/), [D1](https://developers.cloudflare.com/d1/), [limites](https://developers.cloudflare.com/workers/platform/limits/).

## Operação e recuperação

- Observabilidade: no painel Cloudflare, abra Workers & Pages → em-curso → Observability para consultar logs e problemas.
- O Worker grava amostra de 10% das invocações. Evite registrar conteúdo de perguntas, e-mails ou segredos em logs.
- Consulte ../docs/RECUPERACAO_D1.md para Time Travel e exportações manuais do D1.
- O painel de avisos mostra a fila e a última execução automática; aceite do provedor não garante entrega na caixa postal.
