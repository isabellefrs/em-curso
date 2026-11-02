import test from 'node:test';
import assert from 'node:assert/strict';
import { selecionarEventos, formatarData, atualizarEvento, removerEvento } from './eventos.js';

const eventos = [
  { id: 1, titulo: 'Prova de Física', turma: 'turma_a', data: '2026-11-05' },
  { id: 2, titulo: 'Trabalho', turma: 'turma_b', data: '2026-11-06' },
  { id: 3, titulo: 'Feira de Ciências', turma: 'geral', data: '2026-11-07' },
  { id: 4, titulo: 'Prova de Programação', turma: 'turma_b', data: '2026-10-31' },
];

test('turmas A e B incluem gerais, sem eventos exclusivos da outra turma', () => {
  assert.deepEqual(
    selecionarEventos(eventos, 'turma_a', '', 'crescente').map((e) => e.id),
    [1, 3],
  );
  assert.deepEqual(
    selecionarEventos(eventos, 'turma_b', '', 'crescente').map((e) => e.id),
    [4, 2, 3],
  );
});

test('busca ignora acentos, caixa e espaços externos, e combina com turma', () => {
  assert.deepEqual(
    selecionarEventos(eventos, 'todas', ' FISICA ', 'crescente').map((e) => e.id),
    [1],
  );
  assert.equal(selecionarEventos(eventos, 'turma_b', 'fisica', 'crescente').length, 0);
  assert.deepEqual(
    selecionarEventos(eventos, 'turma_a', 'ciencias', 'crescente').map((e) => e.id),
    [3],
  );
});

test('ordena entre meses nos dois sentidos sem modificar a lista original', () => {
  assert.deepEqual(
    selecionarEventos(eventos, 'todas', '', 'crescente').map((e) => e.id),
    [4, 1, 2, 3],
  );
  assert.deepEqual(
    selecionarEventos(eventos, 'todas', '', 'decrescente').map((e) => e.id),
    [3, 2, 1, 4],
  );
  assert.deepEqual(
    eventos.map((e) => e.id),
    [1, 2, 3, 4],
  );
});

test('busca sem correspondência retorna lista vazia', () => {
  assert.deepEqual(selecionarEventos(eventos, 'todas', 'inexistente', 'crescente'), []);
});

test('formata a data civil sem conversão de fuso', () => {
  assert.equal(formatarData('2026-10-31'), '31/10/2026');
});

test('edição altera somente o ID escolhido e preserva dados originais e ID', () => {
  const alterados = atualizarEvento(eventos, 1, {
    titulo: 'Física remarcada',
    data: '2026-12-02',
    id: 999,
  });
  assert.equal(alterados.length, eventos.length);
  assert.equal(alterados[0].id, 1);
  assert.equal(alterados[0].data, '2026-12-02');
  assert.equal(alterados[1], eventos[1]);
  assert.equal(eventos[0].titulo, 'Prova de Física');
});

test('exclusão identifica eventos pelo ID mesmo com títulos repetidos', () => {
  const repetidos = [
    { id: 'a', titulo: 'Prova' },
    { id: 'b', titulo: 'Prova' },
  ];
  assert.deepEqual(removerEvento(repetidos, 'a'), [repetidos[1]]);
  assert.equal(repetidos.length, 2);
  assert.deepEqual(removerEvento(repetidos, 'inexistente'), repetidos);
});
