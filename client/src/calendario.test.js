import test from 'node:test';
import assert from 'node:assert/strict';
import { diasDoMes, mudarMes, eventosDoMes, tituloMes } from './calendario.js';

test('outubro de 2026 começa na quinta e tem 31 dias', () => {
  const dias = diasDoMes('2026-10');
  assert.deepEqual(dias.slice(0, 4), [null, null, null, null]);
  assert.equal(dias[4], '2026-10-01');
  assert.equal(dias.filter(Boolean).length, 31);
  assert.equal(dias.at(-1), '2026-10-31');
});
test('fevereiro respeita ano bissexto e grade com semanas completas', () => {
  assert.equal(diasDoMes('2028-02').filter(Boolean).length, 29);
  assert.equal(diasDoMes('2027-02').filter(Boolean).length, 28);
  assert.equal(diasDoMes('2026-08').length, 42);
});
test('navegação atravessa o ano nos dois sentidos', () => {
  assert.equal(mudarMes('2026-12', 1), '2027-01');
  assert.equal(mudarMes('2027-01', -1), '2026-12');
});
test('lista mensal exclui eventos de outros meses e anos', () => {
  const eventos = [{ data: '2026-11-05' }, { data: '2026-10-31' }, { data: '2027-11-05' }];
  assert.deepEqual(eventosDoMes(eventos, '2026-11'), [eventos[0]]);
  assert.deepEqual(eventosDoMes(eventos, '2026-12'), []);
  assert.match(tituloMes('2026-11'), /novembro.*2026/);
});
