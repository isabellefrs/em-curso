import Assistente from './Assistente.jsx';
import Eventos from './paginas/Eventos.jsx';
import Administracao from './paginas/Administracao.jsx';
import Atendimentos from './paginas/Atendimentos.jsx';
import Avisos from './paginas/Avisos.jsx';

const paginas = {
  '/': {
    nome: 'Calendário',
    subtitulo: 'Sua turma, seus prazos. Tudo em um só lugar.',
    Componente: Eventos,
  },
  '/atendimentos': {
    nome: 'Professores',
    subtitulo: 'Um espaço para perguntar, entender e aprender.',
    Componente: Atendimentos,
  },
  '/avisos': {
    nome: 'Avisos por e-mail',
    subtitulo: 'Os próximos eventos, direto para você.',
    Componente: Avisos,
  },
  '/assistente': {
    nome: 'Assistente IA',
    subtitulo: 'Informação com fonte. Estudos com direção.',
    Componente: Assistente,
  },
  '/admin': {
    nome: 'Administração',
    subtitulo: 'Seu espaço para organizar a turma.',
    Componente: Administracao,
  },
};

export default function App() {
  const caminho = window.location.pathname.replace(/\/$/, '') || '/';
  const pagina = paginas[caminho];
  const Componente = pagina?.Componente;
  return (
    <>
      <a className="pular-conteudo" href="#conteudo">
        Pular para o conteúdo
      </a>
      <main>
        <header>
          <a className="marca" href="/" aria-label="Em Curso, início">
            <img src="/favicon.svg" alt="" width="64" height="64" />
            <div>
              <span className="etiqueta">IFSP ARARAQUARA · 1º Info 2</span>
              <h1>
                Em Curso<span>.</span>
              </h1>
            </div>
          </a>
          <p className="subtitulo">{pagina?.subtitulo || 'Vamos encontrar seu caminho.'}</p>
          <nav className="navegacao" aria-label="Navegação principal">
            {Object.entries(paginas).map(([url, { nome }]) => (
              <a key={url} href={url} aria-current={url === caminho ? 'page' : undefined}>
                {nome}
              </a>
            ))}
          </nav>
          <p className="aviso">Projeto estudantil · Em Curso não é um canal oficial do IFSP.</p>
        </header>
        <div id="conteudo" tabIndex={-1}>
          {Componente ? (
            <Componente />
          ) : (
            <section className="painel">
              <h2>Página não encontrada</h2>
              <a href="/">Voltar ao calendário</a>
            </section>
          )}
        </div>
        <footer className="rodape">
          <span>Em Curso · Aprender, planejar, conectar.</span>
          <a href="/avisos">Receber lembretes da turma ↗</a>
        </footer>
      </main>
    </>
  );
}
