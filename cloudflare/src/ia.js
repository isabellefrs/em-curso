import { criarAssistente } from '../../server/src/assistente.js';
import { ehConsultaCurricular } from '../../server/src/conhecimento-core.js';
import { all, one, run, fail } from './db.js';
export async function statusIA(env) {
  const meta = await one(env.DB, 'SELECT dados FROM conhecimento_meta WHERE id=1');
  if (!meta) return { modo: 'indisponivel' };
  return {
    ...JSON.parse(meta.dados),
    modo: env.GEMINI_API_KEY ? 'gemini' : 'local',
    buscaSemantica: false,
  };
}
export async function usoIA(env) {
  const modelos = await all(
    env.DB,
    `SELECT model, chamadas, prompt_tokens, output_tokens, total_tokens, sem_metadados, inicio, atualizado
    FROM gemini_usage ORDER BY model`,
  );
  const soma = (campo) => modelos.reduce((total, item) => total + item[campo], 0);
  return {
    ativo: Boolean(env.GEMINI_API_KEY),
    modeloConfigurado: env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    chamadas: soma('chamadas'),
    promptTokens: soma('prompt_tokens'),
    outputTokens: soma('output_tokens'),
    totalTokens: soma('total_tokens'),
    semMetadados: soma('sem_metadados'),
    inicio: modelos.length ? Math.min(...modelos.map((m) => m.inicio)) : null,
    atualizado: modelos.length ? Math.max(...modelos.map((m) => m.atualizado)) : null,
    modelos: modelos.map((m) => ({
      nome: m.model,
      chamadas: m.chamadas,
      promptTokens: m.prompt_tokens,
      outputTokens: m.output_tokens,
      totalTokens: m.total_tokens,
      semMetadados: m.sem_metadados,
      inicio: m.inicio,
      atualizado: m.atualizado,
    })),
  };
}
export async function perguntar(env, pergunta) {
  if (typeof pergunta !== 'string' || !pergunta.trim() || pergunta.length > 1200)
    throw fail('Escreva uma pergunta de até 1.200 caracteres.');
  // Normalização antes de formar a expressão FTS: nenhum operador fornecido pelo visitante é executado.
  const consultaCurricular = ehConsultaCurricular(pergunta);
  const words = consultaCurricular
    ? [
        'matriz',
        'curricular',
        'informatica',
        'integrado',
        'programacao',
        'computadores',
        'computacao',
        'interfaces',
      ]
    : [
        ...new Set(
          pergunta
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .match(/[a-z0-9]{3,}/g) || [],
        ),
      ].slice(0, 24);
  const termosBusca = words;
  const expressao = termosBusca.map((w) => '"' + w + '"').join(' OR ');
  const rows = termosBusca.length
    ? await all(
        env.DB,
        `SELECT c.dados FROM conhecimento_fts f JOIN conhecimento c ON c.id=f.id WHERE conhecimento_fts MATCH ? AND c.topic<>'study' ORDER BY rank LIMIT 12`,
        expressao,
      )
    : [];
  const studyMatches = termosBusca.length
    ? await all(
        env.DB,
        `SELECT c.dados FROM conhecimento_fts f JOIN conhecimento c ON c.id=f.id WHERE conhecimento_fts MATCH ? AND c.topic='study' ORDER BY rank LIMIT 8`,
        expressao,
      )
    : [];
  const studyDefaults = await all(
    env.DB,
    `SELECT c.dados FROM conhecimento c JOIN (SELECT MIN(rowid) AS id FROM conhecimento WHERE topic='study' GROUP BY json_extract(dados,'$.documentId')) p ON c.rowid=p.id ORDER BY c.rowid LIMIT 8`,
  );
  const study = [
    ...new Map(
      [...studyMatches, ...studyDefaults].map((row) => {
        const chunk = JSON.parse(row.dados);
        return [chunk.id, row];
      }),
    ).values(),
  ].slice(0, 8);
  const base = {
    documents: [],
    warnings: [],
    chunks: [...rows, ...study].map((r) => JSON.parse(r.dados)),
    indice: null,
  };
  const gemini = env.GEMINI_API_KEY
    ? {
        async json(systemInstruction, dados, schema) {
          const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
          if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw new Error('Modelo inválido');
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: [{ role: 'user', parts: [{ text: JSON.stringify(dados) }] }],
                generationConfig: {
                  temperature: 0,
                  maxOutputTokens: 4096,
                  responseMimeType: 'application/json',
                  responseJsonSchema: schema,
                },
              }),
              signal: AbortSignal.timeout(25000),
            },
          );
          if (!response.ok) throw new Error('IA indisponível');
          const result = await response.json();
          const usage = result.usageMetadata;
          const agora = Date.now();
          try {
            await run(
              env.DB,
              `INSERT INTO gemini_usage
              (model, chamadas, prompt_tokens, output_tokens, total_tokens, sem_metadados, inicio, atualizado)
              VALUES(?, 1, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(model) DO UPDATE SET
                chamadas=chamadas+1,
                prompt_tokens=prompt_tokens+excluded.prompt_tokens,
                output_tokens=output_tokens+excluded.output_tokens,
                total_tokens=total_tokens+excluded.total_tokens,
                sem_metadados=sem_metadados+excluded.sem_metadados,
                atualizado=excluded.atualizado`,
              model,
              Number.isInteger(usage?.promptTokenCount) ? usage.promptTokenCount : 0,
              Number.isInteger(usage?.candidatesTokenCount) ? usage.candidatesTokenCount : 0,
              Number.isInteger(usage?.totalTokenCount) ? usage.totalTokenCount : 0,
              usage ? 0 : 1,
              agora,
              agora,
            );
          } catch {
            // Falhas no contador não devem interromper uma resposta do assistente.
          }
          return JSON.parse(
            result.candidates?.[0]?.content?.parts
              ?.filter((p) => !p.thought)
              .map((p) => p.text || '')
              .join('') || '',
          );
        },
      }
    : null;
  return criarAssistente({ base, gemini }).perguntar(pergunta);
}
