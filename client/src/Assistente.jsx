import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const exemplos = [
  'Como consultar minha frequência no SUAP?',
  'Como emitir uma declaração de matrícula?',
  'Crie um plano de estudo de matemática: tenho 1 hora por dia durante duas semanas.',
  'Como começar a planejar minha carreira em tecnologia?',
];

export default function Assistente() {
  const [status, setStatus] = useState(null);
  const [pergunta, setPergunta] = useState('');
  const [mensagens, setMensagens] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const campo = useRef(null);
  const conversa = useRef(null);
  useEffect(() => {
    api('/assistente/status')
      .then(setStatus)
      .catch((e) => setErro(e.message));
  }, []);
  useEffect(() => {
    if (conversa.current) conversa.current.scrollTop = conversa.current.scrollHeight;
  }, [mensagens, enviando]);

  async function enviar(event) {
    event.preventDefault();
    if (!pergunta.trim() || enviando) return;
    const texto = pergunta.trim();
    setEnviando(true);
    setErro('');
    try {
      const resultado = await api('/assistente/perguntar', {
        method: 'POST',
        body: { pergunta: texto },
        timeout: 90000,
      });
      setMensagens((anteriores) => [...anteriores, { pergunta: texto, ...resultado }]);
      setPergunta('');
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
      campo.current?.focus();
    }
  }

  function tratarEnter(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    const dispositivoMovel =
      navigator.userAgentData?.mobile ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.matchMedia('(hover: none)').matches);
    if (dispositivoMovel) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <section className="assistente-layout" aria-label="Assistente do Em Curso">
      <aside className="assistente-info">
        <span className="etiqueta">SEU APOIO NO CAMPUS</span>
        <h2>
          Uma dúvida a menos.
          <br /> Mais espaço para aprender.
        </h2>
        <p>
          Consulte documentos do IFSP Araraquara, organize seus estudos e explore caminhos
          profissionais.
        </p>
        <div className="base-status">
          <strong>
            {status?.modo === 'gemini'
              ? 'Gemini configurado'
              : status?.modo === 'local'
                ? 'Consulta documental local'
                : 'Verificando conexão…'}
          </strong>
          {status && (
            <p>
              {status.documentos || 0} documentos · {status.paginas || 0} páginas
              <br />
              {status.fontesWeb || 0} fontes da web importadas
            </p>
          )}
          {status?.modo === 'local' && (
            <p>
              A geração de respostas e planos personalizados aguarda a configuração da chave Gemini
              no servidor.
            </p>
          )}
        </div>
        <h3>Por onde começar?</h3>
        <div className="sugestoes">
          {exemplos.map((texto) => (
            <button
              type="button"
              disabled={enviando}
              key={texto}
              onClick={() => {
                setPergunta(texto);
                campo.current?.focus();
              }}
            >
              {texto}
              <span aria-hidden="true"> ↗</span>
            </button>
          ))}
        </div>
        <p className="aviso">
          O assistente atende apenas dúvidas do campus, carreira e planejamento de estudos. As
          fontes da web são cópias datadas, sem navegação em tempo real.
        </p>
      </aside>
      <div className="chat">
        <div className="chat-topo">
          <h2>Assistente Em Curso</h2>
          <span className="etiqueta">FONTES À VISTA</span>
        </div>
        <div ref={conversa} className="conversa" aria-live="polite" aria-busy={enviando}>
          {!mensagens.length && (
            <div className="boas-vindas">
              <span aria-hidden="true">✦</span>
              <h3>Vamos organizar sua vida acadêmica?</h3>
              <p>
                Escreva uma dúvida ou escolha uma sugestão ao lado. Cada pergunta é consultada
                separadamente: inclua o contexto necessário.
              </p>
            </div>
          )}
          {mensagens.map((mensagem, i) => (
            <article className="troca" key={i}>
              <div className="pergunta">
                <strong>Você</strong>
                <p>{mensagem.pergunta}</p>
              </div>
              <div className="resposta">
                <strong>
                  {mensagem.modo === 'local'
                    ? 'Consulta local · sem geração IA'
                    : mensagem.modo === 'gemini'
                      ? 'Em Curso · Gemini'
                      : 'Em Curso'}
                </strong>
                <p className="texto-resposta">{mensagem.texto}</p>
                {mensagem.tabela?.cabecalho?.length > 0 && mensagem.tabela?.linhas?.length > 0 && (
                  <div
                    className="tabela-rotina-scroll"
                    role="region"
                    aria-label="Rotina de estudos sugerida"
                    tabIndex={0}
                  >
                    <table className="tabela-rotina">
                      <thead>
                        <tr>
                          {mensagem.tabela.cabecalho.map((coluna, colunaIndex) => (
                            <th scope="col" key={`${coluna}-${colunaIndex}`}>
                              {coluna}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mensagem.tabela.linhas.map((linha, linhaIndex) => (
                          <tr key={linhaIndex}>
                            {linha.map((celula, colunaIndex) => (
                              <td key={`${linhaIndex}-${colunaIndex}`}>{celula}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {mensagem.fontes.length > 0 && (
                  <div className="fontes">
                    <h4>Confira as fontes</h4>
                    {mensagem.fontes.map((fonte) => (
                      <details key={fonte.numero}>
                        <summary>
                          [{fonte.numero}] {fonte.titulo}
                          {fonte.pagina ? ` · página ${fonte.pagina}` : ''}
                        </summary>
                        {fonte.url && (
                          <p>
                            <a href={fonte.url} target="_blank" rel="noopener noreferrer">
                              Abrir fonte original ↗
                            </a>
                            {fonte.consultadoEm &&
                              ` · consultada em ${new Date(fonte.consultadoEm).toLocaleDateString('pt-BR')}`}
                          </p>
                        )}
                        {fonte.transcricaoVisual && (
                          <p>Transcrição revisada da imagem nesta página.</p>
                        )}
                        <blockquote>{fonte.trecho}</blockquote>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
          {enviando && <p role="status">Consultando a base…</p>}
        </div>
        <form className="chat-form" onSubmit={enviar}>
          <label htmlFor="pergunta-ia">Sua pergunta</label>
          <textarea
            ref={campo}
            id="pergunta-ia"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={tratarEnter}
            maxLength={1200}
            required
            rows={3}
            placeholder="Ex.: Como justificar uma falta no IFSP Araraquara?"
            disabled={enviando}
          />
          <div className="dica-teclado" aria-live="polite">
            <small className="dica-teclado-computador">
              No computador: <kbd>Enter</kbd> envia; <kbd>Shift</kbd> + <kbd>Enter</kbd> pula a
              linha.
            </small>
            <small className="dica-teclado-movel">
              Em dispositivos móveis, <kbd>Enter</kbd> pula a linha. Toque em “Enviar pergunta” para
              enviar.
            </small>
          </div>
          <div className="chat-acoes">
            <small>{pergunta.length}/1.200 caracteres</small>
            <button disabled={enviando || !pergunta.trim()}>
              {enviando ? 'Consultando…' : 'Enviar pergunta ↗'}
            </button>
          </div>
          {erro && (
            <p role="alert" className="erro">
              {erro}
            </p>
          )}
          <small>
            Não envie senhas ou dados pessoais. Com Gemini ativo, a pergunta e trechos relevantes
            são enviados ao Google. Confira regras e prazos com o campus.
          </small>
        </form>
      </div>
    </section>
  );
}
