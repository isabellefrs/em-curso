import { useState } from 'react';
import { api } from '../api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import { Campo, Mensagem } from '../componentes/Interface.jsx';

export default function Avisos() {
  const status = useRecurso('/avisos/status');
  const [acao] = useState(() => {
    const fragmento = new URLSearchParams(window.location.hash.slice(1));
    const tipo = fragmento.has('confirmar')
      ? 'confirmar'
      : fragmento.has('cancelar')
        ? 'cancelar'
        : null;
    return tipo ? { tipo, token: fragmento.get(tipo) } : null;
  });
  const [ocupado, setOcupado] = useState(false),
    [erro, setErro] = useState(''),
    [mensagem, setMensagem] = useState('');
  async function executar(caminho, body) {
    setOcupado(true);
    setErro('');
    try {
      const r = await api(caminho, { method: 'POST', body, timeout: 60000 });
      setMensagem(r.mensagem);
      return true;
    } catch (e) {
      setErro(e.message);
      return false;
    } finally {
      setOcupado(false);
    }
  }
  async function inscrever(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = Object.fromEntries(new FormData(form));
    dados.consentimento = dados.consentimento === 'on';
    if (await executar('/avisos/inscrever', dados)) form.reset();
  }
  return (
    <section className="avisos-layout">
      <div>
        <span className="etiqueta">SEUS PRAZOS, NA SUA CAIXA DE ENTRADA</span>
        <h2>Um lembrete na hora certa.</h2>
        <p>
          Cadastre seu e-mail estudantil e receba avisos dos eventos da sua turma e de todos os
          eventos gerais.
        </p>
        <div className="antecedencias">
          {[7, 3, 1].map((n) => (
            <div key={n}>
              <strong>{n}</strong>
              <span>{n === 1 ? 'dia antes' : 'dias antes'}</span>
            </div>
          ))}
        </div>
        <p>
          Você só começa a receber depois de confirmar o endereço. Cada aviso traz um link para
          cancelar a inscrição.
        </p>
        <p className="aviso">
          Somente @aluno.ifsp.edu.br. Nome, e-mail e turma são usados para enviar os avisos e ficam
          disponíveis à administração da sala.
        </p>
      </div>
      <div className="painel">
        {acao ? (
          <>
            <h3>{acao.tipo === 'confirmar' ? 'Confirmar meu cadastro' : 'Cancelar meus avisos'}</h3>
            <p>
              {acao.tipo === 'confirmar'
                ? 'Confirme abaixo para ativar os lembretes.'
                : 'Ao confirmar, seu cadastro será removido e os próximos avisos serão interrompidos.'}
            </p>
            <button
              disabled={ocupado || Boolean(mensagem)}
              onClick={async () => {
                if (await executar(`/avisos/${acao.tipo}`, { token: acao.token }))
                  window.history.replaceState(null, '', '/avisos');
              }}
            >
              {ocupado
                ? 'Aguarde…'
                : acao.tipo === 'confirmar'
                  ? 'Confirmar e-mail'
                  : 'Confirmar cancelamento'}
            </button>
            <p>
              <a href="/avisos">Voltar ao cadastro</a>
            </p>
          </>
        ) : (
          <>
            <h3>Receber avisos por e-mail</h3>
            {status.dados && !status.dados.habilitado && (
              <p className="aviso-admin">
                O envio aguarda a configuração do e-mail da turma. O cadastro será liberado quando
                estiver ativo.
              </p>
            )}
            <form className="form-grade" onSubmit={inscrever}>
              <Campo titulo="Seu nome" largo>
                <input name="nome" required maxLength={100} autoComplete="name" />
              </Campo>
              <Campo titulo="E-mail estudantil" largo>
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  placeholder="seunome@aluno.ifsp.edu.br"
                  pattern="[^\s@]+@aluno\.ifsp\.edu\.br"
                />
              </Campo>
              <Campo titulo="Sua turma" largo>
                <select name="turma" required defaultValue="">
                  <option value="" disabled>
                    Selecione sua turma
                  </option>
                  <option value="turma_a">Turma A</option>
                  <option value="turma_b">Turma B</option>
                </select>
              </Campo>
              <label className="checkbox campo-largo">
                <input type="checkbox" name="consentimento" required />
                <span>
                  Quero receber os lembretes e entendo que posso cancelar pelo link de qualquer
                  aviso.
                </span>
              </label>
              <button className="campo-largo" disabled={ocupado || !status.dados?.habilitado}>
                {ocupado ? 'Enviando…' : 'Enviar confirmação'}
              </button>
            </form>
          </>
        )}
        <Mensagem erro={erro || status.erro} mensagem={mensagem} />
      </div>
    </section>
  );
}
