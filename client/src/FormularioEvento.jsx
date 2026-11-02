import { useState } from 'react';
import { Campo, Mensagem } from './componentes/Interface.jsx';
import { turmas } from './dominio.js';

export default function FormularioEvento({ onCadastrar, eventoEmEdicao, onCancelar }) {
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviarFormulario(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = Object.fromEntries(new FormData(form));
    dados.titulo = dados.titulo.trim();
    dados.descricao = dados.descricao.trim();
    if (!dados.titulo) {
      setErro('Digite um título.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      await onCadastrar(dados);
      if (!eventoEmEdicao) form.reset();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <details className="cadastro" open={eventoEmEdicao ? true : undefined}>
      <summary>{eventoEmEdicao ? 'Editar evento' : 'Cadastrar evento'}</summary>
      <p className="aviso">
        Escolha a turma que deve visualizar o evento e receber seus lembretes.
      </p>
      <form onSubmit={enviarFormulario}>
        <Campo titulo="Título">
          <input
            name="titulo"
            required
            maxLength={120}
            defaultValue={eventoEmEdicao?.titulo}
            placeholder="Ex.: Prova de Matemática"
            disabled={enviando}
          />
        </Campo>
        <Campo titulo="Data">
          <input
            name="data"
            type="date"
            required
            min="2000-01-01"
            max="2100-12-31"
            defaultValue={eventoEmEdicao?.data}
            disabled={enviando}
          />
        </Campo>
        <Campo titulo="Público do evento">
          <select name="turma" defaultValue={eventoEmEdicao?.turma || 'geral'} disabled={enviando}>
            {Object.entries(turmas).map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo titulo="Descrição (opcional)" largo>
          <textarea
            name="descricao"
            rows={3}
            maxLength={1000}
            defaultValue={eventoEmEdicao?.descricao}
            disabled={enviando}
          />
        </Campo>
        <div className="campo-largo">
          <Mensagem erro={erro} />
        </div>
        <button disabled={enviando}>
          {enviando
            ? 'Salvando…'
            : eventoEmEdicao
              ? 'Salvar alterações'
              : 'Adicionar ao calendário'}
        </button>
        {eventoEmEdicao && (
          <button disabled={enviando} type="button" className="secundario" onClick={onCancelar}>
            Cancelar edição
          </button>
        )}
      </form>
    </details>
  );
}
