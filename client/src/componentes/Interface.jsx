import { Children, cloneElement, useId, useState } from 'react';

export function Campo({ titulo, children, largo = false }) {
  const idGerado = useId();
  const campo = Children.only(children);
  const id = campo.props.id || idGerado;
  return (
    <div className={`campo${largo ? ' campo-largo' : ''}`}>
      <label htmlFor={id}>{titulo}</label>
      {cloneElement(campo, { id })}
    </div>
  );
}
export function Mensagem({ erro, mensagem }) {
  return (
    <>
      {erro && (
        <p role="alert" className="erro">
          {erro}
        </p>
      )}
      {mensagem && (
        <p role="status" className="sucesso">
          {mensagem}
        </p>
      )}
    </>
  );
}
export function Excluir({ nome, onExcluir }) {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  async function excluir() {
    setOcupado(true);
    setErro('');
    try {
      await onExcluir();
      setConfirmando(false);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="exclusao-inline">
      {!confirmando ? (
        <button
          type="button"
          className="perigo"
          aria-label={`Excluir ${nome}`}
          onClick={() => setConfirmando(true)}
        >
          Excluir
        </button>
      ) : (
        <div className="confirmacao" role="group" aria-label={`Confirmar exclusão de ${nome}`}>
          <p>Excluir {nome}? Esta ação não pode ser desfeita.</p>
          <div className="acoes">
            <button
              type="button"
              disabled={ocupado}
              className="secundario"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </button>
            <button type="button" disabled={ocupado} className="perigo" onClick={excluir}>
              {ocupado ? 'Excluindo…' : 'Confirmar exclusão'}
            </button>
          </div>
          <Mensagem erro={erro} />
        </div>
      )}
    </div>
  );
}
