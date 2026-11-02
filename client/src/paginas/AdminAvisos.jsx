import { useEffect, useState } from 'react';
import { useRecurso } from '../hooks/useRecurso.js';
import { Campo, Excluir, Mensagem } from '../componentes/Interface.jsx';
import { turmas, dataHora, normalizarBusca } from '../dominio.js';

export default function AdminAvisos({ requisicao }) {
  const resumo = useRecurso('/admin/avisos');
  const inscritos = useRecurso('/admin/inscritos');
  const [pagina, setPagina] = useState(1);
  const historico = useRecurso(`/admin/envios?pagina=${pagina}`);
  const [busca, setBusca] = useState(''),
    [aba, setAba] = useState('inscritos');
  const [mensagem, setMensagem] = useState(''),
    [erro, setErro] = useState(''),
    [ocupado, setOcupado] = useState(false);
  async function atualizar() {
    await Promise.all([resumo.recarregar(), inscritos.recarregar(), historico.recarregar()]);
  }
  useEffect(() => {
    if (!resumo.dados?.executando) return;
    const timer = setInterval(() => {
      resumo.recarregar();
      historico.recarregar();
    }, 2500);
    return () => clearInterval(timer);
  }, [resumo.dados?.executando, resumo.recarregar, historico.recarregar]);
  async function executar() {
    setOcupado(true);
    setErro('');
    try {
      const r = await requisicao('/admin/lembretes/executar', { method: 'POST', body: {} });
      setMensagem(r.mensagem);
      await atualizar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }
  async function excluir(aluno) {
    await requisicao(`/admin/inscritos/${aluno.id}`, { method: 'DELETE' });
    setMensagem('Cadastro excluído. Os próximos lembretes para esse aluno foram interrompidos.');
    await atualizar();
  }
  const dados = resumo.dados;
  const lista = (inscritos.dados?.inscritos || []).filter((a) =>
    normalizarBusca(a.nome + ' ' + a.email).includes(normalizarBusca(busca)),
  );
  const rotulos = {
    confirmacao: 'Confirmação',
    lembrete: 'Lembrete',
    resumo: 'Resumo à administração',
    enviado: 'Aceito pelo provedor',
    incerto: 'Envio não confirmado',
    pendente: 'Na fila',
    enviando: 'Em envio',
    cancelado: 'Cancelado',
  };
  return (
    <section>
      <div className="titulo-secao">
        <div>
          <span className="etiqueta">COMUNICAÇÃO DA TURMA</span>
          <h2>Inscrições e lembretes</h2>
        </div>
        <button className="secundario" onClick={atualizar} disabled={resumo.carregando}>
          Atualizar painel
        </button>
      </div>
      {dados && (
        <>
          <section className="painel" aria-labelledby="estado-lembretes">
            <h3 id="estado-lembretes">Estado do serviço de lembretes</h3>
            <p>{dados.habilitado ? 'Provedor Brevo configurado.' : 'Envio de e-mail não configurado.'}</p>
            <p>{dados.ultimaAutomatica ? `Última verificação automática: ${dataHora(dados.ultimaAutomatica.inicio)} · ${dados.ultimaAutomatica.estado}.` : 'Ainda não há verificação automática registrada.'}</p>
            <p>Fila: {dados.fila?.pendentes || 0} lembrete(s) aguardando · {dados.fila?.atencao || 0} envio(s) para conferir.</p>
            <p className="aviso">O painel mostra o que o Em Curso registrou. “Aceito pelo provedor” não confirma entrega na caixa de entrada.</p>
          </section>
          <section className="painel-resumo" aria-label="Resumo dos avisos">
            {[
              [dados.ativos, 'Alunos ativos'],
              [dados.pendentes, 'Aguardando confirmação'],
              [dados.eventos, 'Eventos cadastrados'],
              [dados.enviados, 'E-mails aceitos pelo provedor'],
              [dados.lembretes, 'Lembretes enviados'],
              [dados.incertos, 'Envios não confirmados'],
            ].map(([n, label]) => (
              <div key={label}>
                <strong>{n}</strong>
                <span>{label}</span>
              </div>
            ))}
          </section>
          <div className="painel">
            <h3>Verificar lembretes agora</h3>
            <p>
              Verifica os eventos a 7, 3 e 1 dia da data de hoje, sem esperar o ciclo diário. Alunos
              recebem somente sua turma e os eventos gerais. Avisos já processados não são enviados
              novamente.
            </p>
            {!dados.habilitado && (
              <p className="aviso-admin">Configure a chave da API e o remetente verificado no Brevo para habilitar os envios.</p>
            )}
            <button onClick={executar} disabled={ocupado || dados.executando || !dados.habilitado}>
              {dados.executando ? 'Verificação em andamento…' : 'Executar lembretes'}
            </button>
            <p className="aviso">
              Envios não confirmados exigem conferência no provedor; não são repetidos
              automaticamente. “Aceito pelo provedor” não garante chegada à caixa de entrada.
            </p>
          </div>
        </>
      )}
      <Mensagem
        erro={erro || resumo.erro || inscritos.erro || historico.erro}
        mensagem={mensagem}
      />
      <div className="abas" aria-label="Seções de comunicação">
        {[
          ['inscritos', 'Cadastros'],
          ['historico', 'Histórico de e-mails'],
          ['execucoes', 'Verificações'],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={aba === id} onClick={() => setAba(id)}>
            {label}
          </button>
        ))}
      </div>
      {aba === 'inscritos' && (
        <>
          <Campo titulo="Buscar aluno por nome ou e-mail">
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </Campo>
          <p>{lista.length} cadastro(s)</p>
          <div className="tabela-adaptavel">
            <table>
              <caption className="sr-only">Cadastros de avisos</caption>
              <thead>
                <tr>
                  {['Aluno', 'E-mail', 'Turma', 'Situação', 'Ações'].map((h) => (
                    <th scope="col" key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Aluno">{a.nome}</td>
                    <td data-label="E-mail">{a.email}</td>
                    <td data-label="Turma">{turmas[a.turma]}</td>
                    <td data-label="Situação">
                      <span className="selo">{a.ativo ? 'Ativo' : 'Pendente'}</span>
                    </td>
                    <td data-label="Ações">
                      <Excluir nome={`cadastro de ${a.nome}`} onExcluir={() => excluir(a)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!lista.length && <p className="estado-vazio">Nenhum cadastro encontrado.</p>}
        </>
      )}
      {aba === 'historico' && (
        <>
          <div className="tabela-adaptavel">
            <table>
              <caption className="sr-only">Histórico dos e-mails</caption>
              <thead>
                <tr>
                  {['Data', 'Destinatário', 'Tipo / evento', 'Situação'].map((h) => (
                    <th scope="col" key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.dados?.envios.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Data">{dataHora(e.enviado_em || e.criado_em)}</td>
                    <td data-label="Destinatário">
                      {e.tipo === 'resumo'
                        ? 'Administração da sala'
                        : e.email || 'Cadastro excluído'}
                    </td>
                    <td data-label="Tipo / evento">
                      {rotulos[e.tipo]}
                      {e.evento_titulo && (
                        <span className="bloco">
                          {e.evento_titulo} · {e.antecedencia} dia(s) antes
                        </span>
                      )}
                    </td>
                    <td data-label="Situação">
                      {rotulos[e.estado]}
                      {e.detalhe && <small className="bloco">{e.detalhe}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!historico.dados?.total && <p className="estado-vazio">Nenhum envio registrado.</p>}
          <div className="paginacao">
            <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </button>
            <span>
              Página {pagina} de {historico.dados?.paginas || 1}
            </span>
            <button
              disabled={pagina >= (historico.dados?.paginas || 1)}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      )}
      {aba === 'execucoes' && (
        <>
          <p>Últimas 20 verificações. Os horários usam o fuso de São Paulo.</p>
          <div className="tabela-adaptavel">
            <table>
              <caption className="sr-only">Histórico de verificações dos lembretes</caption>
              <thead>
                <tr>
                  {['Início', 'Origem', 'Situação', 'Lembretes', 'Resumo por e-mail'].map((h) => (
                    <th scope="col" key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados?.execucoes.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Início">{dataHora(e.inicio)}</td>
                    <td data-label="Origem">{e.origem === 'automatica' ? 'Diária' : 'Manual'}</td>
                    <td data-label="Situação">
                      {
                        {
                          concluida: 'Concluída',
                          executando: 'Executando',
                          interrompida: 'Interrompida',
                          falhou: 'Falhou',
                        }[e.estado]
                      }
                    </td>
                    <td data-label="Lembretes">
                      {e.enviados} aceitos · {e.falhas} não confirmados
                    </td>
                    <td data-label="Resumo por e-mail">{e.resumo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!dados?.execucoes.length && (
            <p className="estado-vazio">Nenhuma verificação executada.</p>
          )}
        </>
      )}
    </section>
  );
}
