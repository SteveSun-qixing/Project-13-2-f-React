import { describe, it } from 'vitest';

import { checkRoles } from '../src/check/roles.js';
import { buildRoleSnapshotData } from '../src/snapshot-data.js';
import { compareSnapshot, snapshotViolations } from '../src/snapshot.js';
import { assertNoViolations } from '../src/violations.js';
import { docs } from './helpers.js';

const ROLE_SNAPSHOT_SOURCES = [
  '05-接口与契约/07.02-07-应用插件接口-二、接口总览.md',
  '05-接口与契约/08.02-08-基础卡片插件接口-二、接口定义.md',
  '05-接口与契约/08.03-08-基础卡片插件接口-三、BaseCardView 节点渲染视图模型.md',
  '05-接口与契约/08.04-08-基础卡片插件接口-四、IBaseCardEditor 编辑契约.md',
  '05-接口与契约/09.03-09-箱子布局插件接口-三、IBoxLayoutPlugin 接口.md',
  '05-接口与契约/09.04-09-箱子布局插件接口-四、数据模型.md',
  '05-接口与契约/09.06-09-箱子布局插件接口-六、条目渲染与资源访问.md',
  '05-接口与契约/09.07-09-箱子布局插件接口-七、布局编辑面板.md',
  '05-接口与契约/10.02-10-服务插件接口-二、角色契约：IServicePlugin.md',
  '05-接口与契约/10.03-10-服务插件接口-三、服务上下文：IServiceContext.md',
];

describe('角色接口快照与 SDK 导出交叉核对', () => {
  it('四角色入口接口、声明唯一性与导出声明闭合', () => {
    const models = docs();
    assertNoViolations(checkRoles({ docs: models.roles, sdk: models.sdk }));
  });

  it('角色接口快照与文档一致（差异必须显式评审）', () => {
    const models = docs();
    const comparison = compareSnapshot({
      name: 'role-interfaces',
      generator: 'tests/contract/src/snapshot-data.ts#buildRoleSnapshotData',
      sources: ROLE_SNAPSHOT_SOURCES,
      data: buildRoleSnapshotData(models.roles),
    });
    assertNoViolations(snapshotViolations(comparison));
  });
});
