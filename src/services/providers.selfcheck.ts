/**
 * The provider table is seven near-identical rows, which is exactly the shape
 * a typo hides in: a key read from the wrong environment variable, two rows
 * sharing one, a URL missing its path. None of that fails at build time and
 * none of it is visible until a quota runs out and the fallback that was meant
 * to catch it answers nothing.
 *
 *   npx tsx src/services/providers.selfcheck.ts
 */
import assert from 'node:assert';
import { PROVIDERS } from '../../api/generate';
import { FALLBACKS } from './providers';

const names = Object.keys(PROVIDERS);
assert.ok(names.length >= 8, `expected the whole table, got ${names.length}`);

// Every provider the client will ask for must exist on the server, or the
// chain spends a round trip on a 400 that no amount of retrying will fix.
for (const name of FALLBACKS) {
  assert.ok(PROVIDERS[name], `client asks for "${name}" and the server has no row for it`);
}

const keyEnvs = new Set<string>();
for (const [name, p] of Object.entries(PROVIDERS)) {
  assert.ok(p.label, `${name}: no label`);
  assert.ok(p.model, `${name}: no default model`);

  if (p.keyEnv) {
    // Two providers sharing a key variable means one of them is silently
    // reading the other's key, and the failure looks like an upstream outage.
    assert.ok(!keyEnvs.has(p.keyEnv), `${name}: ${p.keyEnv} is already used by another provider`);
    keyEnvs.add(p.keyEnv);
    assert.ok(/^[A-Z0-9_]+$/.test(p.keyEnv), `${name}: ${p.keyEnv} is not an env var name`);
  }
  assert.ok(/^[A-Z0-9_]+$/.test(p.modelEnv), `${name}: ${p.modelEnv} is not an env var name`);

  const url = p.url();
  if (url !== null) {
    assert.ok(url.startsWith('https://'), `${name}: ${url} is not https`);
    assert.ok(/\/chat\/completions$/.test(url), `${name}: ${url} does not end at /chat/completions`);
  }
}

// Cloudflare needs an account id in its address, so it must report itself
// unconfigured rather than building a URL with "undefined" in the path.
const hadAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
delete process.env.CLOUDFLARE_ACCOUNT_ID;
assert.strictEqual(PROVIDERS.cloudflare.url(), null, 'cloudflare built a URL without an account id');
if (hadAccount) process.env.CLOUDFLARE_ACCOUNT_ID = hadAccount;

// A model you host is the only row allowed no key, and it must stay off
// until an address is given — on a serverless deployment localhost is
// nothing, and a row that is always present and always refuses costs a round
// trip on every message forever.
assert.strictEqual(PROVIDERS.ollama.keyEnv, '', 'a self-hosted model should need no key');
const hadOllama = process.env.OLLAMA_URL;
delete process.env.OLLAMA_URL;
assert.strictEqual(PROVIDERS.ollama.url(), null, 'ollama is on without an address');
if (hadOllama) process.env.OLLAMA_URL = hadOllama;

console.log(`providers: ${names.length} rows, ${FALLBACKS.length} in the chain, all checks passed`);
