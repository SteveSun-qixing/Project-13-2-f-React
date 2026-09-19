import { describe, it } from 'vitest';

import { checkSdkExports } from '../src/check/sdk.js';
import { buildSdkSnapshotData } from '../src/snapshot-data.js';
import { compareSnapshot, snapshotViolations } from '../src/snapshot.js';
import { assertNoViolations } from '../src/violations.js';
import { docs } from './helpers.js';

describe('SDK 导出快照与结构检查', () => {
  it('包入口、值导出、类型导出与 testing 导出结构合法', () => {
    assertNoViolations(checkSdkExports({ sdk: docs().sdk }));
  });

  it('SDK 导出清单快照与文档一致（差异必须显式评审）', () => {
    const comparison = compareSnapshot({
      name: 'sdk-exports',
      generator: 'tests/contract/src/snapshot-data.ts#buildSdkSnapshotData',
      sources: [
        '05-接口与契约/02.02-02-SDK-API规范-二、导出入口.md',
        '05-接口与契约/02.08-02-SDK-API规范-八、脚手架（@chips-sdk-scaffold）.md',
      ],
      data: buildSdkSnapshotData(docs().sdk),
    });
    assertNoViolations(snapshotViolations(comparison));
  });
});
