# @chips/antd（fork antd）

> 版本：v1.0.0
> 日期：2026-09-19
> 状态：正式版
> 适用范围：`packages/antd` 的包定位、依赖边界、导出面、主题桥接与版本/补丁口径；补丁格式与升级流程见 `patches/README.md`，视觉数值以《09-统一视觉规范》为权威

---

## 一、定位与边界

`@chips/antd` 是薯片生态对上游 antd 的 fork，是唯一基础组件库；**唯一合法使用方是 `packages/ui`（`@chips/ui`）**，其余包、插件与业务代码一律从 `@chips/ui` 导入组件、Hooks 与 Design Tokens。

依赖方向固定为：`@chips/ui → @chips/antd → antd → React`。

- 本包禁止依赖任何 `@chips/*` 包；运行时依赖只有 `antd` 与 `@ant-design/icons`（精确版本）。
- 其他包声明或导入 `@chips/antd`、任意位置导入 `antd` / `antd/*` 或第二套组件库，由两道防线拦截：
  - `scripts/check-boundary.mjs`（构建/CI 门禁，`pnpm check:boundary`）；
  - ESLint `no-restricted-imports`（`packages/ui` 是唯一例外）。

## 二、导出面策略

1. **组件白名单**：`src/components/index.ts` 逐项列出对 `@chips/ui` 开放的组件与 Props 类型；白名单之外的组件（如 `Layout`、`Tree`、`Transfer`）不进入导出面。
2. **静态成员随组件转发**：`Form.Item`、`Form.useForm`、`Input.TextArea`、`Typography.Title`、`App.useApp` 等随组件值转发，不单独声明。
3. **图标整集再导出**：`src/icons/index.ts` 整集转发 `@ant-design/icons`，保持按需打包；业务不得引入独立图标包。
4. **主题命名空间受限**：只转发 `theme`（业务只用 `theme.useToken()`）与相关类型；antd 的主题算法、locale 切换与 `ConfigProvider` 不对业务开放。
5. **导出面即契约**：`tests/export-surface.test.ts` 同时做运行期与编译期断言；新增/移除组件必须先更新白名单与该测试，再同步《08-@chips-ui共享层使用指南》。

## 三、主题桥接（与 @chips/ui Design Tokens）

- `ChipsThemeRoot`：唯一主题根。fork 独占 `locale`、`App` 上下文（`message` / `notification` / `modal`）、CSS 变量作用域（`--chips-*`、`.css-var-chips`）与单实例优化（`hashed: false`）。
- `validateChipsThemeConfig`：校验 `@chips/ui` 传入的 `ThemeConfig`；只允许 `algorithm` / `token` / `components` 三层，组件级定制仅允许《09-统一视觉规范》§3.4 的 22 个组件，越权字段与越权组件直接抛错。
- `toChipsCssVarName`：Design Token 名 → `--chips-*` 变量名的唯一实现；渲染帧令牌注入按同一命名规则对齐。
- 视觉数值的唯一事实源是 `packages/ui/src/tokens/`；本包只提供安装机制与校验，不定义数值。

## 四、版本与补丁

- 版本跟随上游主版本，口径 `<上游版本>-chips.N`（当前 `6.6.4-chips.1`），不参与平台统一版本。
- 上游版本精确锁定（`antd` 6.6.4、`@ant-design/icons` 6.3.4）；工作区内唯一包管理器为 pnpm，锁文件只在仓库根维护。
- fork 差异全部落在 `patches/`：台账 `patches.json`（按 `upstreams[]` 分节覆盖 antd 及其依赖栈的传递上游）+ `<上游包>@<版本>.patch`，由根 `pnpm.patchedDependencies` 登记；`pnpm check:patches` 校验台账↔补丁↔pnpm 登记↔安装产物一致。
- 当前补丁 `default-locale-zh-cn`（antd）：上游默认 locale 回退、Pagination 与日期/时间组件默认值、dayjs 语言包统一收敛为简体中文（R5 / ADR-006）；`use-delay-state-unmount-cleanup`（`@rc-component/util`）：`useDelayState` 卸载清理挂起 raf/timeout 定时器（工单067）。
- 新增补丁与上游升级必须按 `patches/README.md` 的流程执行，并追加 `开发日志.md`。

## 五、常用命令

```bash
pnpm --filter @chips/antd run build            # tsc 产出 dist/ 与类型声明
pnpm --filter @chips/antd run typecheck
pnpm --filter @chips/antd run test             # vitest（jsdom）
pnpm --filter @chips/antd run test:coverage
pnpm --filter @chips/antd run lint             # eslint + prettier --check
pnpm --filter @chips/antd run check:boundary   # 依赖边界门禁
pnpm --filter @chips/antd run check:patches    # 补丁栈门禁
```

## 六、相关文档

- [开发计划](./开发计划.md)
- [开发日志](./开发日志.md)
- [补丁栈与升级流程](./patches/README.md)
- [08-@chips/ui 共享层使用指南](../../../薯片生态文档库/02-开发规范/08-@chips-ui共享层使用指南.md)
- [09-统一视觉规范](../../../薯片生态文档库/02-开发规范/09-统一视觉规范.md)
- [01-代码组织规范](../../../薯片生态文档库/02-开发规范/01-代码组织规范.md)
- [ADR-008：React + fork antd 前端技术栈](../../../薯片生态文档库/01-架构设计/ADR/ADR-008-React加fork-antd前端技术栈.md)

---

**文档结束**
