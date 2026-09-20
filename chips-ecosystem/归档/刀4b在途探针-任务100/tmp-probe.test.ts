import { register } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { it, expect } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'probe-'));
const logFile = join(dir, 'events.jsonl');
writeFileSync(logFile, '');
const hookSource = `
import { appendFileSync } from 'node:fs';
let cfg = null;
export function initialize(data) { cfg = data; appendFileSync(cfg.logFile, JSON.stringify({ev:'init'}) + '\\n'); }
export async function resolve(specifier, context, nextResolve) {
  appendFileSync(cfg.logFile, JSON.stringify({ev:'resolve',specifier}) + '\\n');
  if (specifier.includes('bad-child')) { throw new Error('PROBE_REJECT ' + specifier); }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  appendFileSync(cfg.logFile, JSON.stringify({ev:'load',url}) + '\\n');
  return nextLoad(url, context);
}
`;
register(
  'data:text/javascript,' + encodeURIComponent(hookSource),
  { parentURL: import.meta.url, data: { logFile } },
);

it('probe: dynamic import from transformed test module fires hooks', async () => {
  const entryUrl = pathToFileURL(join(import.meta.dirname!, 'fixtures/probe/entry.mjs')).href;
  const nonceUrl = entryUrl + '?nonce=probe1';
  let topError: unknown = null;
  let mod: any = null;
  try {
    mod = await import(/* @vite-ignore */ nonceUrl);
  } catch (e) {
    topError = e;
  }
  const events = readFileSync(logFile, 'utf8');
  console.log('TOP_ERROR:', topError);
  console.log('MOD:', mod?.default);
  console.log('EVENTS:\n' + events);
  expect(true).toBe(true);
});

it('probe: bad child rejection propagates from native import', async () => {
  const entryUrl = pathToFileURL(join(import.meta.dirname!, 'fixtures/probe/entry-bad.mjs')).href;
  let topError: any = null;
  try {
    await import(/* @vite-ignore */ entryUrl + '?nonce=probe2');
  } catch (e) {
    topError = e;
  }
  console.log('BAD_TOP_ERROR:', topError?.message ?? topError);
  console.log('BAD_EVAL_MARKER:', (globalThis as any).__PROBE_BAD_EVAL__);
  console.log('EVENTS2:\n' + readFileSync(logFile, 'utf8'));
  expect(true).toBe(true);
});
