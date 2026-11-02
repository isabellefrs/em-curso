# Backup e recuperação do banco D1

Banco de produção: campus-hub. Este guia descreve como consultar pontos de recuperação e criar uma exportação SQL manual.

## Recuperação automática da Cloudflare (Time Travel)

O D1 mantém pontos de recuperação automáticos. No plano gratuito, a retenção documentada é de 7 dias; confira o prazo vigente no painel da Cloudflare antes de depender dele.

No diretório cloudflare, consulte o estado:

    npm.cmd exec wrangler -- d1 time-travel info campus-hub

Para restaurar para um timestamp, consulte a sintaxe instalada e identifique o timestamp desejado:

    npm.cmd exec wrangler -- d1 time-travel restore --help

Atenção: restaurar substitui o estado atual do banco inteiro pelo estado daquele momento. Antes de restaurar, exporte o banco atual, confira a conta e o banco selecionados e faça a restauração em uma janela de manutenção. Não execute uma restauração por tentativa.

## Exportação SQL manual

No diretório cloudflare, gere um arquivo com data no nome:

    npm.cmd exec wrangler -- d1 export campus-hub --remote --output "$env:USERPROFILE\Documents\backup_campus-hub_AAAA-MM-DD.sql"

Substitua AAAA-MM-DD pela data atual. Guarde uma cópia criptografada fora do repositório e verifique se o arquivo não está vazio. A exportação contém dados pessoais de inscritos: limite o acesso e não a envie ao GitHub nem a chats.

Uma política prática é exportar antes de mudanças de banco e guardar uma cópia periódica em local seguro. O projeto não cria cópias externas automaticamente.

## Importação em banco de recuperação

Confirme que o destino é o banco correto e que há uma exportação atual do destino. Para detalhes da versão instalada do Wrangler:

    npm.cmd exec wrangler -- d1 execute --help

A importação executa instruções SQL no banco indicado e pode sobrescrever dados. Não importe um backup diretamente na produção sem revisar a origem e o destino.
