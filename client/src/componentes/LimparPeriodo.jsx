import { useRef, useState } from 'react';
import { Campo, Mensagem } from './Interface.jsx';
import { formatarData } from '../eventos.js';
import { turmas } from '../dominio.js';

export default function LimparPeriodo({ requisicao, onLimpar }) {
  const formulario = useRef(null);
  const [previa, setPrevia] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  async function consultar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    setMensagem('');
    const periodo = Object.fromEntries(new FormData(e.currentTarget));
    try {
      setPrevia({
        ...(await requisicao('/eventos/periodo/previa', { method: 'POST', body: periodo })),
        ...periodo,
      });
    } catch (e) {
      setErro(e.message);
      setPrevia(null);
    } finally {
      setOcupado(false);
    }
  }
  async function excluir() {
    setOcupado(true);
    setErro('');
    try {
      const { inicio, fim } = Object.fromEntries(new FormData(formulario.current));
      if (inicio !== previa.inicio || fim !== previa.fim)
        throw new Error('O período mudou. Confira a prévia novamente.');
      const { removidos } = await requisicao('/eventos/periodo', {
        method: 'DELETE',
        body: { inicio, fim, assinatura: previa.assinatura },
      });
      onLimpar(removidos);
      setPrevia(null);
      setMensagem(`${removidos.length} evento(s) removido(s).`);
    } catch (e) {
      setErro(e.message);
      setPrevia(null);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <details className="painel limpeza">
      <summary>Limpar eventos por período</summary>
      <p>
        As duas datas estão incluídas. Confira a lista antes de confirmar; a exclusão é permanente.
      </p>
      <form ref={formulario} onSubmit={consultar} className="form-grade">
        <Campo titulo="Data inicial">
          <input
            name="inicio"
            type="date"
            required
            min="2000-01-01"
            max="2100-12-31"
            disabled={ocupado}
            onInput={() => setPrevia(null)}
          />
        </Campo>
        <Campo titulo="Data final">
          <input
            name="fim"
            type="date"
            required
            min="2000-01-01"
            max="2100-12-31"
            disabled={ocupado}
            onInput={() => setPrevia(null)}
          />
        </Campo>
        <button disabled={ocupado}>{ocupado ? 'Aguarde…' : 'Conferir eventos do período'}</button>
      </form>
      {previa && (
        <div className="confirmacao">
          <strong>{previa.eventos.length} evento(s) no período</strong>
          <ul className="lista-previa">
            {previa.eventos.map((e) => (
              <li key={e.id}>
                {formatarData(e.data)} · {e.titulo} · {turmas[e.turma]}
              </li>
            ))}
          </ul>
          {previa.eventos.length > 0 && (
            <button type="button" className="perigo" disabled={ocupado} onClick={excluir}>
              Confirmar exclusão dos {previa.eventos.length} eventos
            </button>
          )}
        </div>
      )}
      <Mensagem erro={erro} mensagem={mensagem} />
    </details>
  );
}
