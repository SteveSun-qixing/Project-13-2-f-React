# 发布流程与 Git 协作规范

## 1. 分支策略

- 所有任务必须在任务分支开发
- 分支命名：`codex/<task-name>`
- 任务完成后合并到 `develop`

## 2. 提交流程

1. 本地通过全部质量门禁
2. 单次提交保持语义单一
3. 提交信息采用 Conventional Commits
4. 提交后附带文档更新和测试证据

## 3. 变更边界

- 禁止修改任务范围外文件
- 禁止引入技术选型外第三方依赖（需先评审）
- 禁止提交临时实现、占位实现、TODO 残留

## 4. 文件移除策略

- 禁止直接删除
- 必须移动到 `归档/` 对应归档目录
- 在变更说明中注明原路径与迁移原因

## 5. 版本与发布

- 遵循 semver
- major：破坏性变更
- minor：新增能力且兼容
- patch：兼容修复

发布包必须包含：

- 变更说明
- 兼容性说明
- 回滚策略
- 契约测试与质量门禁通过记录

阶段十发布包标准路径：

- `releases/<version>/release-bundle.json`
- `releases/<version>/CHANGELOG.md`
- `releases/<version>/ROLLBACK.md`

阶段十发布校验命令：

- `npm run verify`
- `npm run quality:gate`
- `npm run release:check`

`release:check` 会校验发布包字段、版本一致性与门禁报告状态，并输出 `reports/release/release-readiness-latest.json`。

## 6. 架构缺陷处理流程

出现以下问题时必须先提工单并暂停推进：

- 生态底层能力未打通导致组件库无法按规范实现
- 核心组件契约缺失且无法在当前任务内闭环
- SDK/Bridge 接口不可用且影响主流程

处理步骤：

1. 在 `项目日志与笔记/问题工单.md` 新增工单
2. 在 `项目日志与笔记/任务清单/<工单编号>/任务说明.md` 新建专项任务文档
3. 停止当前开发推进，等待上游问题处理
