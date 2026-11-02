import { useState } from 'react';

export default function Login({ configurado, onEntrar }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(event) {
    event.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      await onEntrar({ usuario, senha });
    } catch (error) {
      setErro(error.message);
      setSenha('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="login" aria-labelledby="titulo-login">
      <h2 id="titulo-login">Acesso administrativo</h2>
      {!configurado ? (
        <>
          <p>O acesso por usuário e senha ainda está aguardando configuração segura no servidor.</p>
        </>
      ) : (
        <form onSubmit={entrar}>
          <div className="campo">
            <label htmlFor="usuario">Usuário</label>
            <input
              id="usuario"
              autoComplete="username"
              required
              maxLength={40}
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
          </div>
          {erro && (
            <p role="alert" className="erro">
              {erro}
            </p>
          )}
          <button disabled={enviando} type="submit">
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}
    </section>
  );
}
