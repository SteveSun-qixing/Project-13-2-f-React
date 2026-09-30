# 补丁栈（fork 差异的唯一来源）

> 版本：v1.1.0
> 日期：2026-09-30
> 状态：正式版
> 适用范围：`@chips/antd` 补丁栈对上游包的全部修改，覆盖上游 `antd` 本体与其依赖栈内需要修正的传递上游（当前含 `@rc-component/util`）；含补丁与台账的格式、不变量、升级与退役流程。不覆盖 `@chips/antd` 自身源码（`src/`）与主题桥接设计（见包 `README.md` 与《09-统一视觉规范》）

---

## 一、目录内容与不变量

| 文件                          | 作用                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `patches.json`                | 补丁台账：按 `upstreams[]` 分节登记各上游包与版本、fork 版本、每个补丁的 id / 文件 / 目标 / 依据 / 状态 / 安装产物断言                       |
| `<上游包名>@<上游版本>.patch` | 对上游包内容的 unified diff；文件名中的版本必须与该补丁对应的上游版本一致（scope 包名 `/` 写作 `__`，如 `@rc-component__util@1.13.0.patch`） |

不变量：

1. 上游包内容一律不改工作区里的 `node_modules`，只通过 `.patch` + 根 `pnpm.patchedDependencies` 生效；补丁文件是 fork 差异的唯一事实源。
2. 每个 `.patch` 必须在 `patches.json` 中有且仅有一条台账，并由根 `package.json` 的 `pnpm.patchedDependencies` 登记；三者由 `scripts/verify-patches.mjs` 双向校验。
3. 声明 `forkPackage` 的上游（fork 包直接依赖，当前为 `antd`）：台账 `version` 与 `package.json` 中该上游依赖的精确版本必须相等，且 `forkPackage` 的包版本与 `forkVersion` 相等；未声明 `forkPackage` 的传递上游不与 fork 包版本挂钩，仅按台账口径校验。`forkVersion` 口径一律为 `<上游版本>-chips.N`。
4. 补丁只允许修改上游包内容；引入新的运行时依赖必须先回到本包 `package.json` 与依赖评估流程，不在补丁内私加依赖。
5. 退役补丁不删除：`status` 改为 `retired`，从 `pnpm.patchedDependencies` 移除，补丁文件与台账行保留（历史可追溯）。
6. 传递上游补丁的安装产物按 pnpm 存储目录（`node_modules/.pnpm/<包名 / → +>@<版本>_patch_hash=*`）校验；直接上游按 `packages/antd/node_modules/<上游包>` 校验。

## 二、台账字段

| 字段                              | 含义                                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `upstreams[].package` / `version` | 上游包名与精确锁定版本                                                                                                                                          |
| `upstreams[].forkVersion`         | fork 版本，固定 `<上游版本>-chips.N`；补丁集变化时递增 N                                                                                                        |
| `upstreams[].forkPackage`（可选） | fork 包直接依赖的上游必填（当前 `antd` → `@chips/antd`）：校验 fork 包版本与台账 `forkVersion` 相等、依赖版本精确锁定；传递上游省略，仅按 pnpm 存储校验安装产物 |
| `patches[].id`                    | 补丁语义标识（kebab-case），台账内唯一                                                                                                                          |
| `patches[].file`                  | 补丁文件名；必须由 `pnpm patch-commit --patches-dir packages/antd/patches` 生成                                                                                 |
| `patches[].targets`               | 本补丁触及的上游文件路径（包内相对路径）；校验会确认补丁文本覆盖全部目标                                                                                        |
| `patches[].reason`                | 为什么必须有这个补丁（实现语义，不写"临时"）                                                                                                                    |
| `patches[].spec`                  | 补丁依据的权威文档位置（文档库路径 + 章节）                                                                                                                     |
| `patches[].status`                | `applied` / `retired`                                                                                                                                           |
| `patches[].verifications[]`       | 安装产物断言：`file`（相对上游包根）必须包含 `contains` 文本；`verify-patches.mjs` 在被安装的包上逐条检查                                                       |

## 三、新增补丁流程

1. 确认差异无法用 `@chips/antd` 自身源码或主题桥接实现（能在外层实现的，不写补丁）。
2. 在仓库根执行 `pnpm patch <上游包>@<版本>`，按 `pnpm` 输出的路径编辑上游源码。
3. 执行 `pnpm patch-commit <临时目录> --patches-dir packages/antd/patches` 生成补丁并自动登记 `pnpm.patchedDependencies`。
4. 在 `patches.json` 对应 `upstreams[]` 分节写入台账：`id`、`file`、`targets`、`reason`、`spec`、`status: "applied"`、逐条 `verifications`；新上游须新增分节（`package` / `version` / `forkVersion`，fork 包直接依赖另加 `forkPackage`）。
5. 补丁集变化即递增该上游 `forkVersion` 的 `chips.N`；直接依赖（声明 `forkPackage`）同步 `package.json` 版本号，传递上游仅递增台账口径。
6. 运行 `pnpm --filter @chips/antd run check:patches` 与 `pnpm --filter @chips/antd run test`；通过后执行根 `pnpm install` 更新锁文件，再 `pnpm install --frozen-lockfile` 复现。

## 四、上游升级流程

1. **评估**：核对上游变更日志、许可证、包体影响与破坏性变更；确认 `@ant-design/icons` 版本同步。
2. **改清单**：更新 `package.json` 中 `antd` 与 `@ant-design/icons` 的精确版本；`forkVersion` 改为 `<新版本>-chips.1`（补丁在新上游上重新落地）。
3. **重放补丁**：按第三节在 `packages/antd/patches/` 生成新版本补丁文件；旧版本补丁台账行 `status` 改 `retired`，补丁文件保留。
4. **更新台账**：`targets` 与 `verifications` 必须按新上游实际文件路径与新产物文本重写，`spec` 依据保持不变或指向新的规范章节。
5. **验收**：`check:patches` 必须通过；随后执行包内 `test` / `test:coverage` / `lint` / `typecheck` / `build` 与根 `pnpm install --frozen-lockfile`。
6. **记录**：在 `开发日志.md` 追加升级记录（上游版本差、补丁重放结果、验证命令与结果）。

## 五、自检清单

- [ ] 上游版本与台账、`package.json` 完全一致，且为精确版本（无 `^`、`~`）。
- [ ] 每个 `applied` 补丁文件存在、非空、覆盖全部 `targets`，且已登记 `pnpm.patchedDependencies`。
- [ ] 每个补丁都有 `reason` 与非空 `spec`，并有至少一条安装产物断言。
- [ ] 退役补丁保留文件与台账行，且已从 `pnpm.patchedDependencies` 移除。
- [ ] `check:patches`、包内全部脚本与根冻结安装通过。

---

**文档结束**
