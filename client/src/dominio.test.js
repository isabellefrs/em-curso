import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarAtendimentos } from './dominio.js';

test('busca de professores combina nome e matéria sem diferenciar acentos', () => {
  const lista = [
    { professor: 'Márcia', materia: 'Matemática' },
    { professor: 'Marcos', materia: 'História' },
  ];
  assert.equal(filtrarAtendimentos(lista, 'mar', '').length, 2);
  assert.deepEqual(filtrarAtendimentos(lista, 'marcia', 'matematica'), [lista[0]]);
  assert.equal(filtrarAtendimentos(lista, 'marcos', 'matematica').length, 0);
});
