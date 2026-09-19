import { describe, it } from 'vitest';

import { checkFrameProtocol } from '../src/check/frame.js';
import { buildFrameSnapshotData } from '../src/snapshot-data.js';
import { compareSnapshot, snapshotViolations } from '../src/snapshot.js';
import { assertNoViolations } from '../src/violations.js';
import { docs } from './helpers.js';

describe('帧协议消息快照与清单闭合', () => {
  it('消息代码块、消息清单表与出站联合类型逐项闭合', () => {
    assertNoViolations(checkFrameProtocol({ frame: docs().frame }));
  });

  it('帧协议快照与文档一致（差异必须显式评审）', () => {
    const comparison = compareSnapshot({
      name: 'frame-protocol',
      generator: 'tests/contract/src/snapshot-data.ts#buildFrameSnapshotData',
      sources: [
        '01-架构设计/01-子系统设计/05.09-05-渲染引擎设计-九、高度自适应与宿主-内容通信协议.md',
      ],
      data: buildFrameSnapshotData(docs().frame),
    });
    assertNoViolations(snapshotViolations(comparison));
  });
});
