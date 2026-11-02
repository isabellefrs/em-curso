import { useRef, useState } from 'react';
import { api } from '../api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import { selecionarEventos, atualizarEvento, removerEvento } from '../eventos.js';
import { mesAtual, eventosDoMes, tituloMes } from '../calendario.js';
import { turmas } from '../dominio.js';
import Calendario from '../Calendario.jsx';
import CartaoEvento from '../CartaoEvento.jsx';
import FormularioEvento from '../FormularioEvento.jsx';
import LimparPeriodo from '../componentes/LimparPeriodo.jsx';
import { Campo, Mensagem } from '../componentes/Interface.jsx';
import AcessoRapido from '../componentes/AcessoRapido.jsx';

export default function Eventos({ administracao = false, requisicao = api }) {
  const recurso = useRecurso('/eventos');
  const [editando, setEditando] = useState(null),
    [mensagem, setMensagem] = useState('');
  const [turma, setTurma] = useState('todas'),
    [busca, setBusca] = useState(''),
    [ordem, setOrdem] = useState('crescente');
  const [mes, setMes] = useState(mesAtual);
  const formulario = useRef(null);
  const eventos = recurso.dados?.eventos || [];
  const filtrados = selecionarEventos(eventos, turma, busca, ordem);
  const visiveis = administracao ? filtrados : eventosDoMes(filtrados, mes);
  function limparFiltros() {
    setTurma('todas');
    setBusca('');
    setOrdem('crescente');
  }
  async function salvar(dados) {
    const { evento } = await requisicao(`/eventos${editando ? '/' + editando.id : ''}`, {
      method: editando ? 'PUT' : 'POST',
      body: dados,
    });
    recurso.setDados((anterior) => ({
      eventos: editando
        ? atualizarEvento(anterior.eventos, editando.id, evento)
        : [...anterior.eventos, evento],
    }));
    setEditando(null);
    setMes(dados.data.slice(0, 7));
    limparFiltros();
    setMensagem(`“${dados.titulo}” salvo.`);
  }
  async function excluir(evento) {
    await requisicao(`/eventos/${evento.id}`, { method: 'DELETE' });
    recurso.setDados((anterior) => ({ eventos: removerEvento(anterior.eventos, evento.id) }));
    if (editando?.id === evento.id) setEditando(null);
    setMensagem(`“${evento.titulo}” excluído.`);
  }
  function removerPeriodo(ids) {
    recurso.setDados((anterior) => ({
      eventos: anterior.eventos.filter((e) => !ids.includes(e.id)),
    }));
    if (ids.includes(editando?.id)) setEditando(null);
  }
  return (
    <section>
      {!administracao && <AcessoRapido />}
      <div className="titulo-secao">
        <div>
          <span className="etiqueta">SUA ROTINA ACADÊMICA</span>
          <h2>{administracao ? 'Gerenciar eventos' : 'Calendário da turma'}</h2>
        </div>
        <button className="secundario" onClick={recurso.recarregar} disabled={recurso.carregando}>
          Atualizar eventos
        </button>
      </div>
      <div className="legenda" aria-label="Legenda das turmas">
        {Object.entries(turmas).map(([id, nome]) => (
          <span className={`selo-turma ${id}`} key={id}>
            {nome}
          </span>
        ))}
      </div>
      <Mensagem erro={recurso.erro} mensagem={mensagem} />
      {administracao && recurso.dados && (
        <>
          <div ref={formulario} tabIndex={-1} className="area-formulario">
            <FormularioEvento
              key={editando?.id || 'novo'}
              eventoEmEdicao={editando}
              onCadastrar={salvar}
              onCancelar={() => setEditando(null)}
            />
          </div>
          <LimparPeriodo requisicao={requisicao} onLimpar={removerPeriodo} />
        </>
      )}
      <div className="filtros">
        <Campo titulo="Buscar por título">
          <input
            type="search"
            placeholder="Ex.: Física ou trabalho"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </Campo>
        <Campo titulo="Mostrar eventos para">
          <select value={turma} onChange={(e) => setTurma(e.target.value)}>
            <option value="todas">Todas as turmas</option>
            <option value="turma_a">Turma A</option>
            <option value="turma_b">Turma B</option>
          </select>
        </Campo>
        <Campo titulo="Ordem das datas">
          <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
            <option value="crescente">Mais próximos primeiro</option>
            <option value="decrescente">Mais distantes primeiro</option>
          </select>
        </Campo>
        <button className="secundario" onClick={limparFiltros}>
          Limpar filtros
        </button>
      </div>
      {recurso.carregando ? (
        <p role="status">Carregando eventos…</p>
      ) : (
        <>
          {!administracao && <Calendario mes={mes} onMudarMes={setMes} eventos={visiveis} />}
          <h3>{administracao ? 'Eventos de todos os meses' : `Eventos de ${tituloMes(mes)}`}</h3>
          <p role="status">{visiveis.length} evento(s) encontrado(s)</p>
          <section className="eventos" aria-label="Eventos escolares">
            {visiveis.map((e) => (
              <CartaoEvento
                key={e.id}
                evento={e}
                nomeTurma={turmas[e.turma]}
                administracao={administracao}
                onExcluir={excluir}
                onEditar={(e) => {
                  setEditando(e);
                  formulario.current?.scrollIntoView({ block: 'start' });
                  formulario.current?.focus();
                }}
              />
            ))}
            {!visiveis.length && (
              <p className="estado-vazio">
                {administracao
                  ? 'Nenhum evento encontrado. Cadastre um evento ou limpe os filtros.'
                  : 'Nenhum evento neste mês para os filtros escolhidos. Você pode consultar outro mês.'}
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
