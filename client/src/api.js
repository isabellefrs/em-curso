export async function api(caminho, { method = 'GET', body, timeout = 15000 } = {}) {
  let response;
  try {
    response = await fetch(`/api${caminho}`, {
      method,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(timeout),
      headers:
        method === 'GET'
          ? {}
          : {
              'X-Campus-Hub': '1',
              ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(
      'Não foi possível conectar ao Em Curso. Confira sua conexão e tente novamente.',
    );
  }
  let dados;
  try {
    dados = await response.json();
  } catch {
    throw new Error('O servidor não respondeu corretamente. Tente novamente em instantes.');
  }
  if (!response.ok)
    throw Object.assign(new Error(dados.error || 'Não foi possível concluir a operação.'), {
      status: response.status,
    });
  return dados;
}
