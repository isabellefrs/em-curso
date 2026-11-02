export default function Privacidade() {
  return (
    <article className="pagina-texto">
      <span className="etiqueta">TRANSPARÊNCIA</span>
      <h2>Privacidade e dados</h2>
      <p>O Em Curso é um projeto estudantil independente, não um canal oficial do IFSP. Esta página explica o funcionamento dos dados usados pelo site.</p>
      <h3>Calendário e atendimentos</h3>
      <p>Eventos, turmas, descrições e horários de atendimento publicados no site são visíveis a qualquer visitante. Não inclua informações pessoais ou confidenciais nesses cadastros.</p>
      <h3>Avisos por e-mail</h3>
      <p>Para enviar lembretes, o serviço guarda nome, e-mail estudantil, turma, situação da inscrição e datas de confirmação. Esses dados servem para enviar avisos de eventos gerais e da turma escolhida. O envio é processado pelo Brevo.</p>
      <p>O cadastro fica ativo até ser removido pelo aluno ou pela administração. Cancelar remove o cadastro e interrompe novos avisos. O histórico de envios é mantido para auditoria; após a remoção do cadastro, o histórico conserva informações do envio e do evento, sem associar o e-mail e nome removidos.</p>
      <h3>Assistente de IA</h3>
      <p>Quando o Gemini está ativo, a pergunta e trechos relevantes dos documentos importados são enviados ao Google para gerar a resposta. O Em Curso não grava a pergunta e a resposta no banco do site. Evite enviar senhas, dados pessoais ou informações sensíveis.</p>
      <p>O feedback opcional guarda apenas a categoria escolhida e a data, sem a pergunta, resposta ou identidade da pessoa vinculadas a ele.</p>
      <h3>Hospedagem e segurança</h3>
      <p>O site e o banco de dados são hospedados na Cloudflare. O acesso aos painéis administrativos é restrito à pessoa administradora. Medidas técnicas de limitação de requisições podem usar identificadores temporários protegidos e removidos periodicamente.</p>
      <h3>Solicitações</h3>
      <p>Para pedir a remoção de um cadastro de avisos ou esclarecer o uso dos dados, procure a administração do projeto Em Curso.</p>
      <p className="aviso">Esta página descreve as funções implementadas no projeto; consulte-a novamente quando novos recursos de dados forem adicionados.</p>
    </article>
  );
}
