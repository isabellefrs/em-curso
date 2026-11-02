import { load } from 'cheerio';
import { createHash } from 'node:crypto';

export const fontesPermitidas = [
  { url: 'https://www.arq.ifsp.edu.br/', topic: 'campus' },
  {
    url: 'https://www.arq.ifsp.edu.br/tecnicos-integrado/tecnico-em-informatica-integrado',
    topic: 'campus',
  },
  {
    url: 'https://lsc.cornell.edu/how-to-study/studying-for-and-taking-exams/effective-study-strategies/',
    topic: 'study',
  },
  {
    url: 'https://lsc.cornell.edu/how-to-study/studying-for-and-taking-exams/guidelines-for-creating-a-study-schedule/',
    topic: 'study',
  },
  {
    url: 'https://lsc.cornell.edu/how-to-study/studying-for-and-taking-exams/the-five-day-study-plan/',
    topic: 'study',
  },
  {
    url: 'https://lsc.cornell.edu/managing-time-and-stress/getting-organized-in-time-and-space/',
    topic: 'study',
  },
  { url: 'https://lsc.cornell.edu/examples-of-students-plans/', topic: 'study' },
  { url: 'https://www.learningscientists.org/faq', topic: 'study' },
  { url: 'https://www.learningscientists.org/blog/2018/7/5-1', topic: 'study' },
];
function caminhoDeEstudoPermitido(hostname, pathname) {
  if (hostname === 'lsc.cornell.edu')
    return (
      pathname.startsWith('/how-to-study/') ||
      pathname.startsWith('/managing-time-and-stress/') ||
      pathname === '/examples-of-students-plans/'
    );
  if (hostname === 'www.learningscientists.org')
    return pathname === '/faq' || pathname === '/faq/' || pathname.startsWith('/blog/');
  if (hostname === 'learningcommons.ubc.ca')
    return pathname === '/new-to-ubc-learn-from-peers/';
  return false;
}
export function urlPermitida(valor) {
  try {
    const url = new URL(valor);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (['www.arq.ifsp.edu.br', 'arq.ifsp.edu.br'].includes(url.hostname) ||
        caminhoDeEstudoPermitido(url.hostname, url.pathname))
    );
  } catch {
    return false;
  }
}
export async function baixarFonte(fonte, fetcher = fetch) {
  let url = fonte.url;
  const signal = AbortSignal.timeout(20000);
  let response;
  for (let i = 0; i < 4; i++) {
    if (!urlPermitida(url)) throw new Error('Destino fora das fontes autorizadas.');
    response = await fetcher(url, {
      redirect: 'manual',
      signal,
      headers: { 'User-Agent': 'EmCurso/1.0 (educational document index)' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const destino = response.headers.get('location');
      await response.body?.cancel();
      if (!destino) throw new Error('Redirecionamento sem destino.');
      url = new URL(destino, url).href;
      response = null;
    } else break;
  }
  if (!response?.ok)
    throw new Error(`Fonte indisponível (HTTP ${response?.status || 'redirecionamentos'}).`);
  if (!response.headers.get('content-type')?.includes('text/html')) {
    await response.body?.cancel();
    throw new Error('A fonte não é uma página HTML.');
  }
  const partes = [];
  let tamanho = 0;
  for await (const parte of response.body) {
    tamanho += parte.length;
    if (tamanho > 2_000_000) throw new Error('Página acima do limite de tamanho.');
    partes.push(parte);
  }
  const $ = load(Buffer.concat(partes).toString('utf8'));
  $('script,style,nav,header,footer,form,aside,noscript').remove();
  const title =
    fonte.url === 'https://www.arq.ifsp.edu.br/'
      ? 'IFSP Araraquara — página inicial'
      : $('h1').first().text().trim() || $('title').text().trim();
  const principal = $('article').first().length
    ? $('article').first()
    : $('main').first().length
      ? $('main').first()
      : $('body');
  principal.find('p,li,h1,h2,h3,div').append('\n');
  const text = principal
    .text()
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .slice(0, 60000);
  if (text.length < 100) throw new Error('Fonte sem texto suficiente.');
  if (/verify your browser|access denied|just a moment/i.test(`${title}\n${text.slice(0, 500)}`))
    throw new Error('A página retornou uma verificação automática, não conteúdo educacional.');
  const id = createHash('sha256').update(fonte.url).digest('hex').slice(0, 16);
  const document = {
    id,
    title,
    url,
    sourceUrl: fonte.url,
    topic: fonte.topic,
    kind: 'web',
    fetchedAt: new Date().toISOString(),
  };
  const chunks = [];
  for (let i = 0; i < text.length; i += 1200)
    chunks.push({ ...document, id: `${id}-${i}`, documentId: id, text: text.slice(i, i + 1400) });
  return { document, chunks };
}
