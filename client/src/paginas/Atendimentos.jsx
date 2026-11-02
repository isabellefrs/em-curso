import { useRef, useState } from 'react';
import { api } from '../api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import { Campo, Excluir, Mensagem } from '../componentes/Interface.jsx';
import { areas, diasSemana, filtrarAtendimentos } from '../dominio.js';

function Formulario({ atendimento, onSalvar, onCancelar }) {
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function salvar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    const form = e.currentTarget;
    const dados = Object.fromEntries(new FormData(form));
    dados.dia = Number(dados.dia);
    try {
      await onSalvar(dados);
      if (!atendimento) form.reset();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form className="painel form-grade" onSubmit={salvar}>
      <h3 className="campo-largo">
        {atendimento ? 'Editar atendimento' : 'Novo atendimento semanal'}
      </h3>
      <Campo titulo="Professor(a)">
        <input name="professor" required maxLength={100} defaultValue={atendimento?.professor} />
      </Campo>
      <Campo titulo="Matéria">
        <input name="materia" required maxLength={100} defaultValue={atendimento?.materia} />
      </Campo>
      <Campo titulo="Área">
        <select name="area" defaultValue={atendimento?.area || 'exatas'}>
          {Object.entries(areas).map(([valor, [icone, nome]]) => (
            <option key={valor} value={valor}>
              {icone} {nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo titulo="Dia da semana">
        <select name="dia" defaultValue={atendimento?.dia ?? 1}>
          {diasSemana.map((dia, i) => (
            <option key={dia} value={i}>
              {dia}
            </option>
          ))}
        </select>
      </Campo>
      <Campo titulo="Início">
        <input name="inicio" type="time" required defaultValue={atendimento?.inicio} />
      </Campo>
      <Campo titulo="Término">
        <input name="fim" type="time" required defaultValue={atendimento?.fim} />
      </Campo>
      <Campo titulo="Sala">
        <input name="sala" required maxLength={100} defaultValue={atendimento?.sala} />
      </Campo>
      <Campo titulo="E-mail do professor">
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          defaultValue={atendimento?.email}
        />
      </Campo>
      <div className="acoes campo-largo">
        <button disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar atendimento'}</button>
        {atendimento && (
          <button type="button" className="secundario" onClick={onCancelar} disabled={ocupado}>
            Cancelar edição
          </button>
        )}
      </div>
      <Mensagem erro={erro} />
    </form>
  );
}

export default function Atendimentos({ administracao = false, requisicao = api }) {
  const recurso = useRecurso('/atendimentos');
  const [nome, setNome] = useState(''),
    [materia, setMateria] = useState('');
  const [editando, setEditando] = useState(null),
    [mensagem, setMensagem] = useState('');
  const formulario = useRef(null);
  const lista = filtrarAtendimentos(recurso.dados?.atendimentos || [], nome, materia);
  async function salvar(dados) {
    await requisicao(`/atendimentos${editando ? '/' + editando.id : ''}`, {
      method: editando ? 'PUT' : 'POST',
      body: dados,
    });
    setEditando(null);
    setMensagem('Atendimento salvo.');
    await recurso.recarregar();
  }
  async function excluir(a) {
    await requisicao(`/atendimentos/${a.id}`, { method: 'DELETE' });
    if (editando?.id === a.id) setEditando(null);
    setMensagem('Atendimento excluído.');
    await recurso.recarregar();
  }
  return (
    <section>
      <div className="titulo-secao">
        <div>
          <span className="etiqueta">UM TEMPO PARA SUAS DÚVIDAS</span>
          <h2>Atendimento dos professores</h2>
        </div>
        <button
          type="button"
          className="secundario"
          onClick={recurso.recarregar}
          disabled={recurso.carregando}
        >
          Atualizar
        </button>
      </div>
      <p>
        Encontre o professor, a matéria e o melhor horário para conversar. Horários semanais, no
        fuso de São Paulo.
      </p>
      {administracao && (
        <div ref={formulario} tabIndex={-1}>
          <Formulario
            key={editando?.id || 'novo'}
            atendimento={editando}
            onSalvar={salvar}
            onCancelar={() => setEditando(null)}
          />
        </div>
      )}
      <div className="filtros">
        <Campo titulo="Procurar professor">
          <input
            type="search"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do professor"
          />
        </Campo>
        <Campo titulo="Procurar matéria">
          <input
            type="search"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            placeholder="Ex.: Matemática"
          />
        </Campo>
        <button
          className="secundario"
          type="button"
          onClick={() => {
            setNome('');
            setMateria('');
          }}
        >
          Limpar busca
        </button>
      </div>
      <Mensagem erro={recurso.erro} mensagem={mensagem} />
      {recurso.carregando ? (
        <p role="status">Carregando atendimentos…</p>
      ) : (
        <>
          <p role="status">{lista.length} atendimento(s) encontrado(s)</p>
          <div className="tabela-adaptavel">
            <table>
              <caption className="sr-only">Horários de atendimento dos professores</caption>
              <thead>
                <tr>
                  {[
                    'Professor',
                    'Matéria / área',
                    'Dia e horário',
                    'Sala',
                    'Contato',
                    ...(administracao ? ['Ações'] : []),
                  ].map((t) => (
                    <th key={t} scope="col">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Professor">
                      <strong>{a.professor}</strong>
                    </td>
                    <td data-label="Matéria / área">
                      <span className="icone-area" aria-hidden="true">
                        {areas[a.area]?.[0]}
                      </span>{' '}
                      {a.materia}
                      <small className="bloco">{areas[a.area]?.[1]}</small>
                    </td>
                    <td data-label="Dia e horário">
                      {diasSemana[a.dia]}
                      <span className="bloco">
                        {a.inicio} – {a.fim}
                      </span>
                    </td>
                    <td data-label="Sala">{a.sala}</td>
                    <td data-label="Contato">
                      <a href={`mailto:${a.email}`}>{a.email}</a>
                    </td>
                    {administracao && (
                      <td data-label="Ações">
                        <div className="acoes">
                          <button
                            type="button"
                            onClick={() => {
                              setEditando(a);
                              formulario.current?.scrollIntoView({ block: 'start' });
                              formulario.current?.focus();
                            }}
                          >
                            Editar
                          </button>
                          <Excluir
                            nome={`atendimento de ${a.professor}`}
                            onExcluir={() => excluir(a)}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!lista.length && (
            <p className="estado-vazio">
              {nome || materia
                ? 'Nenhum atendimento corresponde à busca.'
                : 'Os atendimentos aparecerão aqui assim que forem cadastrados.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
