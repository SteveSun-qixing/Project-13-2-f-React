# RFC-解析锚定：`@chips/*` 工作区包 TypeScript 解析锚定（工单 003-B 收口）

> 提案：W1-003B（2026-09-20）
> 状态：已实施（本工作区侧收口；工作区迁出旧仓库后的自然终态见 §六）
> 关联：`项目日志与笔记/工单003-新工作区解析回退旧仓库同名包/任务说明.md`（003 原始工单与轨迹证据）
> 改动面：`chips-ecosystem/tsconfig.base.json`（唯一改动文件；各包 tsconfig 与源码零改动）

---

## 一、问题回顾

`chips-ecosystem/` 嵌套于旧仓库根内；旧根 `node_modules/@chips/ui → ../../Chips-Ui`（只读目录，禁改）。新工作区包的 `exports.types` 指向 `dist/index.d.ts`，dist 未构建时 TypeScript 判定失配后**不会终止**，而是继续向祖先 `node_modules` 查找，命中旧仓库同名包并按旧源码解析——旧实现被静默编译进新包的类型检查与 ESLint 类型感知程序，违反「旧版冻结、单一实现」架构红线，并产生假绿/假红（工单 003 所列 127 处 lint 报错同源）。

## 二、约束验证（为什么"纯 dist 锚定 + 缺失即报无法解析"按字面不可实现）

实施前在真实环境（TS 5.9.3）做了三组判定实验：

1. **paths 失配仍回退**（/tmp 轨迹存档见 §五证据表 E2）：在 base 配置写入 `"@chips/ui": ["packages/ui/dist/index"]` 并移走 dist，`--traceResolution` 显示 paths 候选失配后，解析器继续 ancestor node_modules 上溯，最终仍命中 `Chips-Ui/src/index.ts`。
2. **node16 同样逃逸**（E3）：`module/moduleResolution: Node16` 下轨迹同样解析到旧仓库——TS 对"包已命中但 exports 失配"采取宽松续溯，不采用 Node 的"首个命中即终止"语义。
3. **文件系统层无法构造终止点**：祖先查找只在"某个 node_modules 层级成功命中文件"时终止；任何层级的失配只会继续上溯（E1 轨迹中 `chips-ecosystem/node_modules` 未命中后续行至旧根即为证）。旧根 `node_modules` 只读，不能移除逃逸靶标；在工作区内补软链同址同败（dist 缺失时依旧失配续溯）。构建前置校验属被禁止的时序性伪修复。

**结论**：在不触碰旧仓库、不依赖构建时序的前提下，唯一的结构性终结点是**工作区内必然存在（已提交）的路径**。因此锚定候选采用两段式。

## 三、机制（已实施）

`chips-ecosystem/tsconfig.base.json` 新增 `compilerOptions.paths`，全部 `@chips/*` 工作区包显式锚定；每个包两级候选：

1. **官方产物入口**（`exports.types` 对应的 `dist/**`，dist 存在时优先，与发布语义一致）；
2. **工作区内源码入口**（`src/index` 或包实际已提交入口；dist 缺失时在 chips-ecosystem 内终结，解析出的仍是唯一正源的同一份代码，类型判定真实有效，且**永不到达旧仓库**）。

要点：

- TS ≥ 5.x 支持无 `baseUrl` 的 `paths`，且 `extends` 继承的 `paths` 相对**定义所在文件**解析——base 位于工作区根，任意深度的子包 extends 后候选基准均为 `chips-ecosystem/`，无需逐包重复配置（实测 hello 位于三级目录下命中正确，E4/E5）。
- 末尾通配 `"@chips/*": ["./packages/*/dist/index", "./packages/*/src/index", "./tools/*/dist/index", "./tools/*/src/index"]` 为**未来新增工作区包自动生效**层：目录名=包短名约定（现行规范口径）下零配置即被锚定；精确条目优先于通配。
- 真正不存在的包名（拼写错误、未入工作区）在两级候选与通配全部失配且旧根无同名包时，报 `TS2307 Cannot find module`——响失败保留（E6 实测）。

## 四、影响面

- **收益方**：所有 extends base 的 tsconfig（packages/*、tools/*、tests/*、examples/plugins/hello 及各 tsconfig.build.json）的 typecheck、declaration 产出、以及复用同一配置的 ESLint 类型感知程序。解析域收敛为 `chips-ecosystem/**`。
- **不受影响**：运行时解析（node/vite/pnpm 走 `node_modules` + `exports`，`paths` 仅编译期；`tsc` 产物中的裸 specifier 不改写，无产物漂移）；vitest 运行面；`packages/native/types/chips-native.d.ts` 等既有直引路径。
- **行为差异（对照工单 003 期望行为 §五.1）**：dist 缺失时不再可能"静默回退旧包"（核心危害已结构性杜绝）；但也不会报"无法解析"，而是锚定到工作区内同一包的已提交源码并给出真实类型判定。此为 §二实验证明的字面实现在现行 TS 下不存在后的等效机制，理由与轨迹证据如上，供 W1 准出复核确认。
- 工单 003 期望 §五.2 要求的"唯一权威口径"：**在旧仓库 `node_modules` 隔离（旧根清理/工作区迁出）实施前，本 `paths` 锚定为解析唯一权威口径；迁出后本配置保留为第二防线（防任何祖先级同名包回潜），不形成双轨。**

## 五、未来新增工作区包的操作步骤（维护点）

1. **常规情形（零改动）**：新包置于 `packages/<短名>/` 或 `tools/<短名>/`，目录名=包 `@chips/<短名>` 的短名，入口 `src/index.ts`、产物 `dist/index.d.ts` —— 通配层自动锚定，无需任何配置。
2. **目录名与包短名不一致**（或不在 `packages/*`、`tools/*` 下）：在 `tsconfig.base.json` `paths` 通配条目**之前**补一条精确映射，模式照抄现有条目（dist 候选 + src 候选）。
3. **新增子路径导出**（如 `@chips/sdk/testing` 型）：为每个子路径补精确条目，候选分别对齐 `exports` 中该子路径的 types 产物路径与源码路径。
4. **调整构建产物目录/声明文件结构**（如 host 的 `dist/types/`）：同步更新该包精确条目的 dist 候选。
5. 变更后可用复现命令自检（见 §七 V1），确认轨迹无 `Chips-Ui`/`Chips-SDK` 等工作区外路径。

## 六、验收证据与退出状态

| # | 项 | 结果 |
| --- | --- | --- |
| E1 | 红复现（改动前，ui dist 缺失，工单 §四步骤 4 原命令） | `EXIT=1`；轨迹命中 `.../node_modules/@chips/ui/src/index.ts` → realpath `Chips-Ui/src/index.ts`，Package ID `@chips/ui/src/index.ts@0.1.0`（日志 `/tmp/w003b-red.log`） |
| E2 | 纯 dist paths 探针（改动中实验） | paths 失配后仍回退，`Chips-Ui` 出现 255 次（`/tmp/w003b-probe1.log`）→ 促成两段式设计 |
| E3 | node16 探针 | 同样逃逸（`/tmp/w003b-probe2.log`） |
| E4 | 修复后红用例复跑（ui dist 仍缺失） | `EXIT=0`；`@chips/ui` → `chips-ecosystem/packages/ui/src/index.ts`；全轨迹 `Chips-Ui`/`Chips-SDK` 命中 **0** 次（`/tmp/w003b-green2.log`） |
| E5 | 修复后 dist 恢复 | `@chips/ui` → `packages/ui/dist/index.d.ts`（官方入口优先），`Chips-Ui` 命中 0（`/tmp/w003b-green3.log`）；`@chips/sdk`、`@chips/antd` 同样止步工作区 |
| E6 | 未知名 `@chips/does-not-exist` | `error TS2307`，EXIT=1（`/tmp/w003b-unknown.log`）——无静默成功 |
| V1 | 门禁（修复后，dist 齐备） | `pnpm -r --if-present run typecheck` **EXIT=0**；`pnpm -r --if-present run build` **EXIT=0** |
| V2 | 半态鲁棒性 | 移走**全部 8 个** dist 后 `pnpm -r --if-present run typecheck` 仍 **EXIT=0**、旧仓库命中 0——证伪"构建 dist 后再检查"的时序依赖 |

（/tmp 日志为过程留痕副本，正式口径以本表为准；收口复跑命令：`pnpm --filter @chips/plugin-hello exec tsc --noEmit -p tsconfig.json --traceResolution`。）

## 七、收口后事项

- 工单 003（台账第二行 003，解析回退）状态改「已收口」；旧仓库 `node_modules` 隔离/工作区迁出属用户级架构动作，不在本工单执行面内，完成后本 RFC §三机制降级为第二防线（保留）。
- 本 RFC 与 `chips-ecosystem/tsconfig.base.json` 的 `//paths` 注释互为索引；若后续《TypeScript 编码规范》需要收录该口径（根配置属公共资产），由文档波次从本 RFC 提炼，不在本轮改共用文档（工单 004 已在册文档漂移一并处理）。

**文档结束**
