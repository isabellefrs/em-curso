# Interface do Campus Hub

React com JavaScript, Vite e CSS. O calendário público consulta o servidor; a administração exige sessão e usa a mesma API para cadastrar, editar e excluir eventos.

## Executar

Abra um terminal dentro de campus-hub/client:

```powershell
npm.cmd run dev
```

Endereço fixo: http://127.0.0.1:5175. O servidor precisa estar rodando em outro terminal, conforme ../server/README.md. A porta fixa mantém a configuração de origem e o acesso aos dados antigos do navegador. Se a porta estiver ocupada, use o processo já aberto ou encerre-o pelo terminal correspondente.

## Arquivos principais

- App.jsx: consulta dados, mantém o estado e coordena as telas.
- Login.jsx: formulário de autenticação e instruções da primeira conta.
- api.js: comunicação HTTP com /api, tratamento de erros e tempo limite.
- FormularioEvento.jsx: cadastro e edição; só limpa os campos após sucesso.
- CartaoEvento.jsx: apresentação, edição e confirmação de exclusão.
- Calendario.jsx e calendario.js: grade e cálculos mensais.
- eventos.js: busca, ordenação e transformações de listas.
- armazenamento.js: preservado para exportar dados da prévia anterior.
- styles.css: aparência.

## Verificação

```powershell
node --test src/eventos.test.js src/calendario.test.js src/armazenamento.test.js
npm.cmd run build
```

As operações administrativas são autorizadas pelo servidor. Esconder os controles públicos não é a proteção de acesso. A persistência principal agora está em SQLite, não no localStorage. Não há atualização automática entre abas: use Atualizar dados.
