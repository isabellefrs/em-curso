import { useRef, useState } from 'react';
import { formatarData } from './eventos.js';
import { baixarIcs } from './ical.js';

export default function CartaoEvento({
  evento,
  nomeTurma,
  administracao = false,
  onEditar,
  onExcluir,
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState('');
  const excluirRef = useRef(null);

  function cancelarExclusao() {
    setConfirmando(false);
    excluirRef.current?.focus();
  }

  async function confirmarExclusao() {
    setExcluindo(true);
    setErro('');
    try {
      await onExcluir(evento);
    } catch (error) {
      setErro(error.message);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <article className={`evento ${evento.turma}`} id={`evento-${evento.id}`} tabIndex={-1}>
      <span className="turma">{nomeTurma}</span>
      <h2>{evento.titulo}</h2>
      <p>{evento.descricao}</p>
      <p>
        Data: <time dateTime={evento.data}>{formatarData(evento.data)}</time>
      </p>
      {!administracao && <button type="button" className="secundario" onClick={() => baixarIcs([evento])}>Adicionar ao calendário (.ics)</button>}
      {administracao && (
        <div className="acoes-evento">
          <button
            type="button"
            onClick={() => {
              setConfirmando(false);
              onEditar(evento);
            }}
            aria-label={`Editar ${evento.titulo}`}
          >
            Editar
          </button>
          <button
            ref={excluirRef}
            type="button"
            className="perigo"
            onClick={() => setConfirmando(true)}
            aria-expanded={confirmando}
            aria-controls={`confirmacao-${evento.id}`}
            aria-label={`Excluir ${evento.titulo}`}
          >
            Excluir
          </button>
        </div>
      )}
      {administracao && confirmando && (
        <div
          id={`confirmacao-${evento.id}`}
          className="confirmacao"
          role="group"
          aria-label={`Confirmar exclusão de ${evento.titulo}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') cancelarExclusao();
          }}
        >
          <p>Excluir “{evento.titulo}” do banco do Em Curso?</p>
          <p>Data do evento: {formatarData(evento.data)}</p>
          <div className="acoes-evento">
            <button
              disabled={excluindo}
              type="button"
              autoFocus
              className="secundario"
              onClick={cancelarExclusao}
            >
              Manter evento
            </button>
            <button
              disabled={excluindo}
              type="button"
              className="perigo"
              onClick={confirmarExclusao}
            >
              {excluindo ? 'Excluindo…' : 'Confirmar exclusão'}
            </button>
          </div>
          {erro && (
            <p role="alert" className="erro">
              {erro}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
