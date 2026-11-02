import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { verifyGoogleIdentity } from '../src/auth.js';
test('Google: valida assinatura, emissor, público, nonce, e-mail verificado e conta permitida', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const env = { GOOGLE_CLIENT_ID: 'cliente-ficticio', ADMIN_GOOGLE_EMAIL: 'admin@example.test' };
  const sign = (claims = {}, options = {}) =>
    new SignJWT({
      email: 'admin@example.test',
      email_verified: true,
      nonce: 'nonce-correto',
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('sub-ficticio')
      .setIssuer(options.issuer || 'https://accounts.google.com')
      .setAudience(options.aud || env.GOOGLE_CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime(options.exp || '5m')
      .sign(privateKey);
  assert.deepEqual(await verifyGoogleIdentity(await sign(), env, 'nonce-correto', publicKey), {
    sub: 'sub-ficticio',
    email: 'admin@example.test',
  });
  for (const [claims, opts, nonce] of [
    [{ email: 'intruso@example.test' }, {}, 'nonce-correto'],
    [{ email_verified: false }, {}, 'nonce-correto'],
    [{}, { aud: 'outro' }, 'nonce-correto'],
    [{}, { issuer: 'https://intruso.test' }, 'nonce-correto'],
    [{}, { exp: '-1s' }, 'nonce-correto'],
    [{}, {}, 'nonce-incorreto'],
  ])
    await assert.rejects(verifyGoogleIdentity(await sign(claims, opts), env, nonce, publicKey));
  const other = await generateKeyPair('RS256');
  await assert.rejects(verifyGoogleIdentity(await sign(), env, 'nonce-correto', other.publicKey));
});
