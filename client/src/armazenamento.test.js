import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarEventos, salvarEventos } from './armazenamento.js';

const exemplos = [{ id: 1, titulo: 'Prova', data: '2026-11-05', turma: 'geral', descricao: '' }];
const memoria = (valor) => ({
  getItem: () => valor,
  setItem: (_, novo) => {
    valor = novo;
  },
});

test('primeira abertura usa exemplos e uma lista salva vazia continua vazia', () => {
  assert.deepEqual(carregarEventos(memoria(null), exemplos).eventos, exemplos);
  assert.deepEqual(carregarEventos(memoria('[]'), exemplos).eventos, []);
});
test('salvar e recarregar mantém alterações', () => {
  const storage = memoria(null);
  const alterados = [{ ...exemplos[0], titulo: 'Prova remarcada' }];
  assert.equal(salvarEventos(storage, alterados), true);
  assert.deepEqual(carregarEventos(storage, exemplos).eventos, alterados);
});
test('dados corrompidos ou incompatíveis geram aviso sem sobrescrever o conteúdo', () => {
  for (const texto of [
    '{',
    '{}',
    '[null]',
    JSON.stringify([{ ...exemplos[0], data: '2026-02-30' }]),
    JSON.stringify([exemplos[0], exemplos[0]]),
  ]) {
    const storage = memoria(texto);
    const resultado = carregarEventos(storage, exemplos);
    assert.deepEqual(resultado.eventos, exemplos);
    assert.ok(resultado.aviso);
    assert.equal(storage.getItem(), texto);
  }
});
test('bloqueio ou limite de armazenamento é informado', () => {
  const storage = {
    getItem() {
      throw new Error('bloqueado');
    },
    setItem() {
      throw new Error('limite');
    },
  };
  assert.ok(carregarEventos(storage, exemplos).aviso);
  assert.equal(salvarEventos(storage, exemplos), false);
});
