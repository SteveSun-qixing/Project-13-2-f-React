/**
 * cpk 夹具链契约守卫（G8）：对 `tests/e2e/fixtures/cpk` 的在用夹具执行
 * 重建链逐字节比对与五阶段校验矩阵（经 `@chips/cli` 正式 pack/validate 链路，
 * 《03-插件包格式》§六/§八、《07-CLI完整参考》§3.5.2/§3.5.3）。
 *
 * 判定委托给夹具生成器自身的 `--check`（生成与校验同源，单一事实回路）：
 * 任何 `packages/*.cpk`、`checklist.json` 与生成链产物的漂移都会在此显红。
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const generatorPath = fileURLToPath(
  new URL('../../e2e/fixtures/cpk/generate-cpk-fixtures.mjs', import.meta.url)
);

describe('cpk 夹具链（装载器与插件链 E2E 在用输入）', () => {
  it('生成器入口存在（fixtures/cpk 资产完整）', () => {
    expect(existsSync(generatorPath)).toBe(true);
  });

  it('--check：重建链逐字节一致且五阶段校验矩阵（1 正 3 负）符合期望', () => {
    const result = spawnSync(process.execPath, [generatorPath, '--check'], {
      encoding: 'utf8',
      timeout: 180_000,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('五阶段校验矩阵（1 正 3 负）全部符合期望');
  }, 200_000);
});
