import { existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { buildContract, checkContract } from '../src/generate.js';
import { createFileReader } from '../src/load.js';
import { parseContract } from '../src/parse.js';
import { DEFAULT_DOCS_ROOT, DEFAULT_OUT_DIR, contractSources } from '../src/sources.js';
import { validateContract } from '../src/validate.js';

const docsAvailable = existsSync(DEFAULT_DOCS_ROOT);
const reader = createFileReader(DEFAULT_DOCS_ROOT);

describe('真实文档库契约', () => {
  it.skipIf(!docsAvailable)('解析与全部门禁规则通过', () => {
    const parsed = parseContract(reader, contractSources);
    expect(validateContract(parsed)).toEqual([]);
    expect(parsed.capabilities).toHaveLength(60);
    expect(parsed.permissions).toHaveLength(25);
    expect(parsed.events).toHaveLength(39);
    expect(parsed.errorCodes.length).toBeGreaterThan(0);
  });

  it.skipIf(!docsAvailable)('生成物与文档库一致（门禁比对）', () => {
    const result = checkContract({ reader, sources: contractSources, outDir: DEFAULT_OUT_DIR });
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.skipIf(!docsAvailable)('生成物通过 TypeScript 严格编译', () => {
    const build = buildContract({ reader, sources: contractSources });
    const fileNames = build.files.map((file) => path.join(DEFAULT_OUT_DIR, file.path));
    for (const fileName of fileNames) {
      expect(existsSync(fileName)).toBe(true);
    }
    const program = ts.createProgram({
      rootNames: fileNames,
      options: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      },
    });
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    const formatted = diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    );
    expect(formatted).toEqual([]);
  });
});
