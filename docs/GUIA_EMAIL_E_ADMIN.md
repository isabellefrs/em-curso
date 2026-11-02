# Administração, professores e avisos por e-mail

Entrega de 30/10/2026. Implementação local; o calendário antigo não foi modificado.

## Usar as novas páginas

- `/`: calendário com legenda e filtros. Geral usa verde-sálvia `#A2B997`, turma A orquídea `#DA70D6`, turma B pêssego `#FBCEB1`. As cores aparecem na grade, nos cartões e na legenda. O nome da turma continua visível para não depender só de cor.
- `/atendimentos`: tabela de atendimento semanal, com professor, matéria/área, dia, início/término, sala e contato. Busca por professor e matéria pode ser combinada e ignora acentos. Áreas: exatas, humanas, sociais, natureza, linguagens, tecnologia e outras.
- `/avisos`: inscrição com nome, e-mail `@aluno.ifsp.edu.br`, turma A/B e consentimento. O aluno confirma a posse do endereço por um link válido por 24 horas. Links não executam ações apenas ao abrir: a página pede confirmação. Todo lembrete inclui cancelamento da inscrição.
- `/admin`: seções Eventos, Alunos e e-mails, Professores. Todas as alterações e informações de alunos exigem sessão administrativa.

## Limpeza por período

Na seção Eventos, abra “Limpar eventos por período”, informe as duas datas e consulte a prévia. As datas inicial e final estão incluídas e a limpeza abrange todas as turmas. O botão final informa quantos eventos serão removidos.

Se algum evento do intervalo tiver sido incluído, alterado ou removido depois da prévia, o servidor interrompe a exclusão e exige uma nova consulta. A exclusão é permanente. Remover eventos não remove o histórico de e-mails; lembretes ainda na fila são cancelados ao serem processados. Uma mensagem já aceita pelo SMTP não pode ser recolhida.

## Ativar o Gmail da sala

Os campos foram preparados em `server/.env`, sem substituir configurações que já existiam. Os envios permanecem desabilitados por padrão:

```dotenv
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=sala@example.com
SMTP_PASSWORD=
ADMIN_REPORT_EMAIL=admin@example.com
PUBLIC_URL=http://127.0.0.1:5175
REMINDER_HOUR=8
```

1. Configure uma conta remetente própria e verificada no provedor de e-mail. Não coloque senhas no projeto. Referência oficial: https://support.google.com/accounts/answer/185833?hl=pt-BR
2. Preencha `SMTP_PASSWORD` diretamente no `.env` local. Não envie credenciais pelo chat e não as coloque em arquivos do cliente.
3. Para alunos acessarem os links de confirmação e cancelamento, `PUBLIC_URL` deve ser o endereço público HTTPS do Campus Hub. `localhost` e `127.0.0.1` só funcionam no próprio computador. Inclua a origem pública em `APP_ORIGINS` ao implantar.
4. Defina `EMAIL_ENABLED=true` somente quando a configuração estiver pronta e reinicie o servidor. Isso habilita inscrições e a rotina automática.
5. Faça uma inscrição real controlada e confira a confirmação, o lembrete e o resumo na caixa de entrada. Essa validação real não foi executada nesta entrega, pois não há credencial SMTP configurada.

O serviço envia individualmente, sem expor a lista de destinatários. O resumo vai somente para `ADMIN_REPORT_EMAIL`, informando quantidade de lembretes aceitos pelo SMTP e envios não confirmados. Não envia resumo em execuções sem novos avisos.

## Horário e deduplicação

A rotina verifica a data civil no fuso `America/Sao_Paulo`, independentemente do fuso do computador. Por padrão, inicia uma vez por dia a partir das 08:00. O processo verifica a necessidade a cada minuto e também ao iniciar. Se iniciar depois das 08:00, executa a verificação daquele dia. O botão “Executar lembretes” permite rodar antes ou depois do ciclo diário.

Somente eventos a exatamente 7, 3 ou 1 dia são selecionados. Eventos gerais vão a todos os inscritos ativos; eventos A/B vão à turma correspondente. Pendentes de confirmação não recebem lembretes. Não há disparos retroativos para dias em que o servidor ficou desligado.

Cada aviso possui chave única por inscrição + evento + data do evento + antecedência, persistida no SQLite. Repetir o botão ou reiniciar o servidor não duplica avisos já processados. Se a data do evento mudar, a nova data tem seu próprio conjunto de lembretes. A rotina relê evento e inscrição antes de cada envio, verificando exclusões e alterações de público.

SMTP não oferece uma transação atômica com o banco. Quando o resultado é ambíguo (timeout, queda de conexão ou reinício durante envio), o histórico marca “Envio não confirmado”, sem repetir automaticamente. Confira a caixa de enviados/provedor antes de qualquer decisão de reenvio. Um envio já em trânsito pode terminar após cancelamento; os seguintes serão interrompidos.

A automação exige servidor ligado. Para produção, hospede o backend continuamente, com SQLite em disco persistente, backup, HTTPS e **um único processo de rotina**. Múltiplas réplicas do agendador não são suportadas nesta versão. A hospedagem não foi criada nesta entrega.

## Painel e privacidade

O painel mostra alunos ativos, inscrições pendentes, eventos cadastrados, total de e-mails aceitos, total de lembretes e envios não confirmados. Histórico paginado de 25 e-mails e últimas 20 verificações. Aceitação pelo SMTP não garante entrega na caixa de entrada.

A exclusão de cadastro ou o cancelamento pelo link remove nome, e-mail, turma e tokens do cadastro. O histórico mantém tipo, evento, horário e resultado; referências à pessoa ficam nulas e aparecem como “Cadastro excluído”. Não há lista de alunos em endpoints públicos. Links de confirmação e cancelamento usam tokens aleatórios, guardados apenas como hash; fragmentos de URL evitam incluí-los no endereço HTTP enviado ao servidor ao abrir a página.

A inscrição pública tem limite por IP e intervalo de 15 minutos para reenviar confirmação ao mesmo endereço. Um pedido público não altera turma/nome de um endereço já confirmado. Para trocar de turma, cancele a inscrição e confirme um novo cadastro, ou peça à administração para excluir o anterior. Dados pendentes permanecem listados até remoção administrativa; links expiram em 24 horas.

## Organização do código

- `client/src/App.jsx`: navegação e estrutura da página; cada página busca somente seus próprios dados.
- `client/src/paginas/`: calendário, administração, professores, inscrição e painel de e-mails.
- `client/src/componentes/`: campos, mensagens, confirmação de exclusão e limpeza por período.
- `client/src/hooks/useRecurso.js`: carregamento/recarregamento com descarte de respostas antigas.
- `client/src/dominio.js`: nomes de turmas, áreas, dias e filtro de professores.
- `client/src/styles/`: estilos específicos do assistente e da comunidade; o CSS principal concentra tema e componentes comuns.
- `server/src/rotas-*.js`: autenticação, eventos, professores e avisos separados.
- `server/src/notificacoes.js`: inscrições, confirmação, seleção de destinatários, fila e histórico.
- `server/src/email.js`: transporte SMTP; testes substituem o envio por uma implementação em memória.
- `server/src/agendador.js`: horário diário. `validacao.js`: validações e esquemas reutilizados.

O formulário de eventos foi simplificado com FormData, removendo estados redundantes. A grade agrupa eventos por dia antes de renderizar. O favicon usa um SVG que reenquadra a imagem original, sem redesenhá-la, para ocupar aproximadamente o dobro da largura visual no ícone da aba.

## Conferência e desenvolvimento

No servidor: `npm.cmd test`. No cliente: `npm.cmd test`, `npm.cmd run build` e `npm.cmd run format:check`. Para formatar: `npm.cmd run format` na pasta client (inclui os módulos e testes do servidor).

A prévia de interface usa `npm.cmd run preview:qa` na pasta client: portas 5176/3002, banco exclusivamente em memória, exemplos fictícios e nenhum e-mail real. `/api/qa/entrar` dessa prévia cria acesso apenas à sessão de teste. Essa rota não existe no servidor normal e o script não importa `.env`. Encerre a prévia ao terminar; não a publique.

Foram exercitados o formulário de atendimento, busca combinada, inscrição simulada, execução manual/histórico e prévia de limpeza. A exclusão definitiva e suas proteções foram verificadas com banco isolado nos testes da API. Layouts revisados em 320, 390, 768 e 1280 pixels; a tabela de professores se transforma em cartões no celular/tablet. Isso não equivale a testar todos os aparelhos e navegadores existentes.
