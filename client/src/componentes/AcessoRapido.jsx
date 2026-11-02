const servicos = [
  {
    nome: 'Moodle',
    descricao: 'Aulas, materiais e atividades',
    url: 'https://moodle.arq.ifsp.edu.br/login/index.php',
    simbolo: 'M',
  },
  {
    nome: 'SUAP',
    descricao: 'Notas, frequência e serviços acadêmicos',
    url: 'https://suap.ifsp.edu.br/accounts/login/',
    simbolo: 'S',
  },
  {
    nome: 'IFSP Araraquara',
    descricao: 'Site oficial do campus',
    url: 'https://www.arq.ifsp.edu.br/',
    simbolo: 'IF',
  },
];

export default function AcessoRapido() {
  return (
    <nav className="acesso-rapido" aria-label="Acesso rápido aos serviços do campus">
      {servicos.map(({ nome, descricao, url, simbolo }) => (
        <a key={nome} href={url} target="_blank" rel="noopener noreferrer">
          <span className="servico-icone" aria-hidden="true">
            {simbolo}
          </span>
          <span>
            <strong>{nome}</strong>
            <small>{descricao}</small>
          </span>
          <span className="servico-seta" aria-hidden="true">
            ↗
          </span>
          <span className="sr-only">Abre em nova aba</span>
        </a>
      ))}
    </nav>
  );
}
