import { describe, expect, it } from 'vitest';

import { createChildProcessCommandRunner } from '../src/platform/mac/command-runner.js';

describe('createChildProcessCommandRunner', () => {
  it('should collect stdout from a real command', async () => {
    const runner = createChildProcessCommandRunner();
    const result = await runner.run(process.execPath, ['-e', 'process.stdout.write("ok")']);

    expect(result).toEqual({ stdout: 'ok', stderr: '', exitCode: 0 });
  });

  it('should reject when the command does not exist', async () => {
    const runner = createChildProcessCommandRunner();
    await expect(runner.run('chips-command-that-does-not-exist', [])).rejects.toThrow();
  });

  it('should reject when the command exceeds the timeout', async () => {
    const runner = createChildProcessCommandRunner(50);
    await expect(runner.run(process.execPath, ['-e', 'setTimeout(() => undefined, 5000)'])).rejects.toThrow();
  });
});
