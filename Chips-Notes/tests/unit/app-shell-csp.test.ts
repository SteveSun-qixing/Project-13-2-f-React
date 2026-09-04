import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexHtmlPath = path.resolve(__dirname, '../../index.html');

describe('editing engine app shell csp', () => {
  it('allows remote webpage iframes for the formal webpage basecard flow', () => {
    const html = readFileSync(indexHtmlPath, 'utf-8');

    expect(html).toContain("frame-src 'self' file: http: https: blob: chips-render:;");
  });
});
