import { diasDoMes, mudarMes, tituloMes, mesAtual } from './calendario.js';
import { turmas } from './dominio.js';

// Props são os dados e funções que App entrega a este componente.
export default function Calendario({ mes, onMudarMes, eventos }) {
  const dias = diasDoMes(mes);
  const semanas = Array.from({ length: dias.length / 7 }, (_, indice) =>
    dias.slice(indice * 7, indice * 7 + 7),
  );
  const porDia = new Map();
  for (const evento of eventos)
    porDia.set(evento.data, [...(porDia.get(evento.data) || []), evento]);

  return (
    <section aria-label="Calendário mensal" className="calendario">
      <div className="navegacao-mes">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => onMudarMes(mudarMes(mes, -1))}
        >
          ← Anterior
        </button>
        <h2 aria-live="polite">{tituloMes(mes)}</h2>
        <button type="button" aria-label="Próximo mês" onClick={() => onMudarMes(mudarMes(mes, 1))}>
          Próximo →
        </button>
      </div>
      <button type="button" className="mes-atual" onClick={() => onMudarMes(mesAtual())}>
        Ir para o mês atual
      </button>
      <p className="aviso">
        Selecione um evento para ver os detalhes abaixo. A legenda identifica o público de cada
        evento.
      </p>
      <div
        className="tabela-calendario"
        tabIndex={0}
        role="region"
        aria-label="Grade mensal com rolagem horizontal"
      >
        <table>
          <caption className="sr-only">Eventos de {tituloMes(mes)}</caption>
          <thead>
            <tr>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
                <th scope="col" key={dia}>
                  {dia}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanas.map((semana, indice) => (
              <tr key={indice}>
                {semana.map((data, coluna) => (
                  <td key={data || `vazio-${coluna}`} className={data ? '' : 'dia-vazio'}>
                    {data && (
                      <>
                        <time dateTime={data} className="numero-dia">
                          {Number(data.slice(-2))}
                        </time>
                        <ul>
                          {(porDia.get(data) || []).map((evento) => (
                            <li key={evento.id}>
                              <a
                                className={`evento-link ${evento.turma}`}
                                href={`#evento-${evento.id}`}
                                aria-label={`${evento.titulo}, ${turmas[evento.turma]}`}
                              >
                                {evento.titulo}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
