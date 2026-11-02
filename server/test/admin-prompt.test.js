import test from 'node:test';
import assert from 'node:assert/strict';
import { render } from '@inquirer/testing';
import { password } from '@inquirer/prompts';
import {
  configuracaoSenha,
  configuracaoConfirmacao,
  validarSenha,
  validarUsuario,
} from '../scripts/perguntar-admin.js';

test('validação informa tamanho mínimo, máximo e usuário inválido', () => {
  assert.match(validarSenha('curta'), /Faltam 7/);
  assert.equal(validarSenha('a'.repeat(12)), true);
  assert.equal(validarSenha('a'.repeat(128)), true);
  assert.match(validarSenha('a'.repeat(129)), /máximo 128/);
  assert.notEqual(validarUsuario('a b'), true);
});

test('senha mostra asteriscos e permite corrigir tamanho', { timeout: 5000 }, async () => {
  const { answer, events, getScreen, nextRender } = await render(password, configuracaoSenha);
  events.type('curta');
  assert.match(getScreen(), /\*{5}/);
  assert.ok(!getScreen().includes('curta'));
  events.keypress('enter');
  await nextRender();
  assert.match(getScreen(), /Faltam 7/);
  events.type('1234567');
  events.keypress('enter');
  assert.equal(await answer, 'curta1234567');
  assert.ok(!getScreen().includes('curta1234567'));
});

test('confirmação incorreta permite apagar e tentar novamente', { timeout: 5000 }, async () => {
  const { answer, events, getScreen, nextRender } = await render(
    password,
    configuracaoConfirmacao('senha-de-teste'),
  );
  events.type('errada');
  events.keypress('enter');
  await nextRender();
  assert.match(getScreen(), /não coincidem/);
  for (let i = 0; i < 6; i++) events.keypress('backspace');
  events.type('senha-de-teste');
  events.keypress('enter');
  assert.equal(await answer, 'senha-de-teste');
});
