import { describe, it } from 'vitest';

import { checkEvents } from '../src/check/events.js';
import { buildEventSnapshotData } from '../src/snapshot-data.js';
import { compareSnapshot, snapshotViolations } from '../src/snapshot.js';
import { assertNoViolations } from '../src/violations.js';
import { bridgeCode, docs } from './helpers.js';

const EVENT_SNAPSHOT_SOURCES = [
  '05-接口与契约/05.02-05-事件契约规范-二、命名契约.md',
  '05-接口与契约/05.04-05-事件契约规范-四、标准事件.md',
  '05-接口与契约/05.05-05-事件契约规范-四、标准事件-4.1 插件生命周期.md',
  '05-接口与契约/05.06-05-事件契约规范-四、标准事件-4.2 文档.md',
  '05-接口与契约/05.07-05-事件契约规范-四、标准事件-4.3 文件.md',
  '05-接口与契约/05.08-05-事件契约规范-四、标准事件-4.4 资源.md',
  '05-接口与契约/05.09-05-事件契约规范-四、标准事件-4.5 配置.md',
  '05-接口与契约/05.10-05-事件契约规范-四、标准事件-4.6 安全与审计.md',
  '05-接口与契约/05.11-05-事件契约规范-四、标准事件-4.7 窗口与应用.md',
  '05-接口与契约/05.12-05-事件契约规范-四、标准事件-4.8 同步.md',
  '05-接口与契约/05.13-05-事件契约规范-四、标准事件-4.10 托盘、快捷键与传输.md',
];

describe('事件表一致性', () => {
  it('标准事件登记表与 Bridge STANDARD_EVENTS 的 ID 与可见性逐项一致', () => {
    const models = docs();
    assertNoViolations(checkEvents({ docs: models.events, code: bridgeCode() }));
  });

  it('事件 payload、触发时机与可见性快照与文档一致（差异必须显式评审）', () => {
    const comparison = compareSnapshot({
      name: 'event-contracts',
      generator: 'tests/contract/src/snapshot-data.ts#buildEventSnapshotData',
      sources: EVENT_SNAPSHOT_SOURCES,
      data: buildEventSnapshotData(docs().events),
    });
    assertNoViolations(snapshotViolations(comparison));
  });
});
