# Campus Hub — assistente e identidade visual

## O que funciona nesta entrega

- Calendário React com filtros por turma, mês e busca; administração autenticada com eventos persistidos em SQLite.
- Nova identidade: dourado #D3AF37, Deep Sky Blue #28C2FF, Cool Sky #60AFFF, Smart Blue #3066BE e texto branco. Fundos azuis escuros derivados mantêm contraste. Favicon original fornecido pela estudante.
- Página /assistente com sugestões, consulta, respostas e fontes expansíveis com página ou URL/data.
- 31 PDFs importados (468 páginas). Extração por página, trechos com sobreposição e identificação pelo hash do arquivo.
- Oito páginas com pouco texto foram revisadas visualmente. Quatro ganharam transcrições dos procedimentos; quatro contêm encerramentos ou tabela vazia. As transcrições estão vinculadas ao hash da versão revisada em scripts/revisoes-visuais.json.
- Três páginas web autorizadas importadas: IFSP Araraquara (início e curso técnico em Informática) e Effective Study Strategies do Learning Strategies Center da Cornell.
- Cadastro administrativo com asteriscos e validação que permite corrigir senha curta ou confirmação incorreta sem começar novamente.

## Ativação do Gemini

O arquivo server/.env local foi preparado, sem chave. Abra-o no VS Code e preencha GEMINI_API_KEY. Não envie a chave pelo chat nem use prefixo VITE_ para ela. Reinicie o servidor após salvar.

Padrões configuráveis: gemini-3.5-flash-lite para geração, gemini-embedding-2 para embeddings. Os nomes foram conferidos na documentação oficial em 29/10/2026. A disponibilidade e a cota dependem da conta Google.

Sem chave, o sistema funciona como consulta documental local e mostra isso explicitamente. Não cria respostas ou planos fingindo usar IA. Com chave, classifica o pedido e gera a resposta com o SDK @google/genai. Falhas do provedor são informadas sem expor credenciais.

Para usar também busca semântica (opcional), execute na pasta server:

```powershell
npm.cmd run ai:index
```

Esse comando envia os trechos da base ao Google e usa a cota da API. Mantém o índice anterior até terminar com sucesso. Reinicie o servidor quando concluir. Sem índice válido, a geração usa busca textual. Mudar o conteúdo dos documentos invalida o índice anterior pelo hash do corpus.

Não foram feitas chamadas reais de geração/embeddings nesta entrega: a chave não está configurada. Os testes usam um provedor simulado. Validar respostas reais e calibrar recuperação com perguntas representativas após ativação é uma etapa necessária antes de disponibilizar publicamente.

## Como iniciar

Em dois terminais:

```powershell
cd "C:\Users\isabe\OneDrive\Documentos\ChatGPT\calendario\campus-hub\server"
npm.cmd run dev
```

```powershell
cd "C:\Users\isabe\OneDrive\Documentos\ChatGPT\calendario\campus-hub\client"
npm.cmd run dev
```

Abra http://127.0.0.1:5175/assistente. Administração: /admin. Para criar uma nova conta, execute npm.cmd run admin:create na pasta server. Não há conta padrão nem alteração de senhas existentes.

## Arquitetura e restrições

Referência conceitual: minicurso de Igor Sasaki (https://github.com/IgorSasaki/minicurso-ia-node-ifsp). Implementação original em JavaScript: montagem Fastify separada do processo, dependência do provedor injetada, extração/chunks, índice vetorial persistido, similaridade por cosseno, contexto com fontes e ausência explícita de resposta quando falta sustentação. Não foi copiado código do minicurso.

Fluxo: pergunta → classificação de escopo → busca textual/semântica → Gemini com trechos → validação das referências → resposta e fontes. No modo local, palavras-chave só selecionam consulta documental; não há geração livre.

Escopo: documentos e site do IFSP Araraquara, orientação de carreira, criação/ajuste de planos e técnicas de estudo. O classificador deve rejeitar conteúdo geral, resolução de exercícios, pedidos mistos e tentativas de mudar regras. Fontes e perguntas são tratadas como dados, nunca como instruções. A geração distingue as modalidades de ensino e não deve aplicar regras da graduação ao técnico integrado.

Planos usam técnicas da fonte curada; carreira admite orientação geral sem inventar vagas, salários ou fatos atuais. Campus exige fonte recuperada. Números de referência inexistentes são rejeitados, e links vêm exclusivamente dos metadados de fontes importadas. A interface renderiza texto, sem HTML gerado.

Essas defesas reduzem erros, mas não constituem garantia absoluta contra alucinação ou prompt injection. Os testes simulados verificam o fluxo; não comprovam o comportamento de um modelo real. Documentos podem estar desatualizados, ter tabelas/diagramas incompletos na extração ou regras de outra modalidade. A revisão visual foi focada nas páginas com pouco texto, não uma auditoria de todas as 468 páginas.

A consulta não usa eventos do calendário como fonte de regras institucionais. Cada pergunta é independente; o histórico exibido permanece apenas na memória da página e não é persistido. O servidor não registra perguntas em banco. Com Gemini ativo, pergunta e trechos relevantes são enviados ao Google.

## Fontes web e atualização

```powershell
npm.cmd run ai:web
```

A lista fica em src/fontes-web.js. URLs de usuários nunca são baixadas. HTTPS, host exato, redirecionamentos validados, timeout e limite de tamanho protegem a importação. Não acessa SUAP/Moodle privados nem redes sociais. Falha de atualização mantém cópia anterior com sua data original, sem apresentá-la como atualizada. Reinicie o servidor após atualizar; regenere o índice semântico se desejar.

A importação consulta somente as páginas cadastradas, não o site inteiro nem a web em tempo real. A data de consulta aparece junto às fontes. A página inicial pode conter notícias que mudam frequentemente.

Fontes:
- https://www.arq.ifsp.edu.br/
- https://www.arq.ifsp.edu.br/tecnicos-integrado/tecnico-em-informatica-integrado
- https://lsc.cornell.edu/how-to-study/studying-for-and-taking-exams/effective-study-strategies/
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/embeddings

## Reimportar os documentos

Use Python com pypdf instalado:

```powershell
python scripts/extrair-documentos.py "C:\Users\isabe\OneDrive\Documentos\Documentos IFSP Araraquara.zip"
```

No ambiente desta entrega foi usado o Python do runtime do Codex. O script lê o ZIP sem executar conteúdo, copia PDFs com nomes derivados de hash e grava corpus.json em data/knowledge. A base, PDFs, banco, índices e .env estão ignorados no Git: um checkout novo precisa reimportar os documentos. Preserve backup local de server/data, sem compartilhar sessões ou dados privados publicamente.

## Validação e limites de implantação

- Servidor: npm.cmd test.
- Cliente: node --test src/*.test.js e npm.cmd run build.
- Cobertura: persistência, autenticação, CRUD, filtros, datas, prompts de senha, consulta com fontes, recusas, referências inválidas, falhas do provedor, origem, esquema de entrada, limitação de uso e redirecionamento web não autorizado.
- Consulta pública limitada a 10 pedidos por IP a cada 15 minutos; limite em memória reinicia com o processo. Máximo 1.200 caracteres por pergunta. Cada consulta Gemini pode fazer duas chamadas de geração e uma de embedding.
- Desenvolvimento local, sem publicação. Antes de hospedar: HTTPS, armazenamento persistente, backup, recuperação de conta, controle de custo e teste com Gemini real. Atendimento docente e notificações foram implementados na entrega seguinte; consulte GUIA_EMAIL_E_ADMIN.md para o estado do SMTP e ativação.
