import { useState } from 'react';
import { api } from '../api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import { carregarEventos, armazenamentoDoNavegador } from '../armazenamento.js';
import Login from '../Login.jsx';
import Eventos from './Eventos.jsx';
import Atendimentos from './Atendimentos.jsx';
import AdminAvisos from './AdminAvisos.jsx';
import UsoIA from './UsoIA.jsx';
import { Mensagem } from '../componentes/Interface.jsx';

export default function Administracao() {
  const sessao = useRecurso('/auth/session');
  const [aba, setAba] = useState('eventos'),
    [erro, setErro] = useState('');
  const admin = sessao.dados?.admin;
  async function entrar(credenciais) {
    const { admin } = await api('/auth/login', { method: 'POST', body: credenciais });
    setErro('');
    sessao.setDados({ admin, configurado: true });
  }
  async function requisicao(caminho, opcoes) {
    try {
      return await api(caminho, opcoes);
    } catch (e) {
      if (e.status === 401) {
        sessao.setDados((anterior) => ({ ...anterior, admin: null }));
        setErro('Sua sessão expirou. Entre novamente.');
      }
      throw e;
    }
  }
  async function sair() {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
      sessao.setDados((anterior) => ({ ...anterior, admin: null }));
    } catch (e) {
      setErro(e.message);
    }
  }
  function exportarPrevia() {
    const anterior = carregarEventos(armazenamentoDoNavegador, []);
    if (anterior.aviso) {
      setErro(anterior.aviso);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(anterior.eventos, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'campus-hub-previa-local.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <Mensagem erro={erro || sessao.erro} />
      {sessao.carregando ? (
        <p role="status">Verificando sessão…</p>
      ) : !admin ? (
        <>
          <Login
            configurado={sessao.dados?.configurado}
            onEntrar={entrar}
          />
          <button className="secundario" onClick={sessao.recarregar}>
            Verificar configuração novamente
          </button>
        </>
      ) : (
        <>
          <div className="sessao-admin">
            <span>
              Conectado como <strong>{admin.usuario}</strong>
            </span>
            <button className="secundario" onClick={sair}>
              Sair
            </button>
            <details>
              <summary>Cópia da prévia antiga</summary>
              <button onClick={exportarPrevia}>Baixar dados antigos do navegador</button>
            </details>
          </div>
          <div className="abas admin-abas" aria-label="Seções administrativas">
            {[
              ['eventos', 'Eventos'],
              ['avisos', 'Alunos e e-mails'],
              ['atendimentos', 'Professores'],
              ['ia', 'Uso do Gemini'],
            ].map(([id, nome]) => (
              <button key={id} aria-pressed={aba === id} onClick={() => setAba(id)}>
                {nome}
              </button>
            ))}
          </div>
          {aba === 'eventos' && <Eventos administracao requisicao={requisicao} />}
          {aba === 'avisos' && <AdminAvisos requisicao={requisicao} />}
          {aba === 'atendimentos' && <Atendimentos administracao requisicao={requisicao} />}
          {aba === 'ia' && <UsoIA requisicao={requisicao} />}
        </>
      )}
    </>
  );
}
