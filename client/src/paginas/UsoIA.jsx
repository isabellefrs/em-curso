import { useRecurso } from '../hooks/useRecurso.js';

const numero = (valor = 0) => new Intl.NumberFormat('pt-BR').format(valor);
const dataHora = (valor) =>
  valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;

export default function UsoIA({ requisicao }) {
  const recurso = useRecurso('/admin/ia/uso');
  const feedback = useRecurso('/admin/ia/feedback');
  const dados = recurso.dados;

  async function atualizar() {
    try {
      await requisicao('/admin/ia/uso');
      await Promise.all([recurso.recarregar(), feedback.recarregar()]);
    } catch {
      await Promise.all([recurso.recarregar(), feedback.recarregar()]);
    }
  }

  return (
    <section>
      <div className="titulo-secao">
        <div>
          <span className="etiqueta">USO DO MODELO</span>
          <h2>Consumo do Gemini</h2>
        </div>
        <button className="secundario" onClick={atualizar} disabled={recurso.carregando}>
          Atualizar painel
        </button>
      </div>
      {recurso.carregando && !dados && <p role="status">Carregando uso do Gemini…</p>}
      {recurso.erro && <p className="erro" role="alert">{recurso.erro}</p>}
      {!recurso.carregando && !dados && !recurso.erro && (
        <p className="estado-vazio">Não foi possível carregar os dados de uso.</p>
      )}
      {dados && (
        <>
          {!dados.ativo && (
            <p className="aviso-admin">A chave do Gemini não está ativa no Worker.</p>
          )}
          <p className="aviso">
            Modelo configurado: <strong>{dados.modeloConfigurado}</strong>. Os totais contam chamadas
            feitas pelo Em Curso desde a ativação deste painel{dados.inicio ? `, iniciada em ${dataHora(dados.inicio)}` : ''}.
            Chamadas feitas diretamente no AI Studio ou em outros aplicativos não entram aqui.
          </p>
          <section className="painel-resumo" aria-label="Uso acumulado do Gemini">
            {[
              [numero(dados.chamadas), 'Chamadas ao Gemini'],
              [numero(dados.promptTokens), 'Tokens de entrada'],
              [numero(dados.outputTokens), 'Tokens de saída'],
              [numero(dados.totalTokens), 'Tokens totais reportados'],
            ].map(([valor, rotulo]) => (
              <div key={rotulo}>
                <strong>{valor}</strong>
                <span>{rotulo}</span>
              </div>
            ))}
          </section>
          {dados.semMetadados > 0 && (
            <p className="aviso-admin">
              Em {numero(dados.semMetadados)} chamada(s), o Gemini não retornou metadados de uso; essas
              chamadas contam no total, mas não nos tokens.
            </p>
          )}
          {dados.modelos.length > 0 && (
            <div className="tabela-adaptavel">
              <table>
                <caption>Consumo acumulado por modelo</caption>
                <thead>
                  <tr>
                    {['Modelo', 'Chamadas', 'Entrada', 'Saída', 'Total'].map((titulo) => (
                      <th key={titulo} scope="col">{titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dados.modelos.map((modelo) => (
                    <tr key={modelo.nome}>
                      <td data-label="Modelo">{modelo.nome}</td>
                      <td data-label="Chamadas">{numero(modelo.chamadas)}</td>
                      <td data-label="Entrada">{numero(modelo.promptTokens)}</td>
                      <td data-label="Saída">{numero(modelo.outputTokens)}</td>
                      <td data-label="Total">{numero(modelo.totalTokens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dados.atualizado && (
            <p className="aviso">Última chamada contabilizada: {dataHora(dados.atualizado)}.</p>
          )}
          {!dados.chamadas && (
            <p className="estado-vazio">Ainda não há chamadas registradas. O contador começa na próxima consulta ao Gemini.</p>
          )}
          <div className="painel" aria-labelledby="feedback-ia-titulo">
            <h3 id="feedback-ia-titulo">Retorno sobre as respostas</h3>
            <p>Últimos 30 dias: {feedback.dados?.total || 0} avaliações · {feedback.dados?.ajudou || 0} ajudaram · {feedback.dados?.melhorar || 0} pediram melhoria. Total desde o início: {feedback.dados?.totalGeral || 0}.</p>
            <p className="aviso">Guardamos apenas a avaliação e a data. A pergunta, a resposta e a identidade do visitante não são armazenadas junto do feedback.</p>
          </div>
          <div className="painel">
            <h3>Limite gratuito disponível</h3>
            <p>
              O Gemini não informa à aplicação um saldo restante de tokens gratuitos. A cota depende
              do modelo e dos limites do projeto; consulte os valores atuais no Google AI Studio.
            </p>
            <a href="https://aistudio.google.com/usage" target="_blank" rel="noopener noreferrer">
              Abrir uso e limites no Google AI Studio ↗
            </a>
            <p className="aviso">
              O histórico deste painel começa quando o contador foi ativado. O consumo anterior não
              pode ser recuperado pela API usada pelo Em Curso.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
