# RFC-G9 插件 devDependencies 放行 @chips/cli 裁定

- 日期：2026-09-30 ｜ 提出方：Goal-Mode 主智能体（task044 审计后收口批） ｜ 状态：已生效
- 影响面：`chips-ecosystem/tools/gates/gates.config.json`（`boundaries.allowedDevInternal`）；全部官方插件的 `package` 脚本；G9 门禁判定结果。

## 一、问题

G9 架构边界门禁（`tools/gates/check-boundaries.mjs` BOUNDARY010）对 devDependencies 采用全局白名单 `allowedDevInternal`（此前仅 `@chips/testing`），而官方插件的正式打包链路依赖 CLI：

- 全部官方插件 `package.json` 的 `package` 脚本为 `pnpm exec chips plugin pack --out dist/`，`chips` 二进制来自 devDependency `@chips/cli`（workspace:*）。
- 脚手架 `tools/scaffold/src/templates/shared.ts`、`index.ts` 生成的四角色模板同样写入该 devDep——即官方工具链自身生成的工程即触发 BOUNDARY010。
- 实测违规 6 条：plugins/layouts/grid、plugins/basecards/hyperlink、plugins/services/{cardtohtml,content-image} 的 devDependencies `@chips/cli`（gates:all，2026-09-30 20:41）。

## 二、裁定

`@chips/cli` 属官方打包工具链，插件以 devDependency 形式引用与「插件运行时零 CLI 依赖」的架构约束不冲突：CLI 仅存在于开发/打包期，不进插件产物（`vite build` 只打包 src；`chips plugin pack` 在插件工程外执行）。

裁定：`boundaries.allowedDevInternal` 增补 `@chips/cli`，与既有 `@chips/testing`（测试工具链先例）同构。

```json
"allowedDevInternal": ["@chips/testing", "@chips/cli"],
```

## 三、理由与边界

1. 与 G9 fail-closed 哲学一致：白名单是显式登记而非豁免扫描；运行时依赖（dependencies）仍禁止 `@chips/cli`。
2. 单一事实源：脚手架模板、官方插件 manifest、门禁白名单三处口径统一为「devDep 允许、运行时禁止」。
3. BOUNDARY020（Node 内置模块）不在此裁定范围：vitest.config.ts 的 `node:url` 一律改写消除，不走白名单。

## 四、验收

- `pnpm gates:all`（或单跑 boundaries）后 BOUNDARY010 六条全部消除；
- `pnpm gates:test` 门禁自测保持全绿（自测未断言 allowedDevInternal 具体内容，2026-09-30 核对）；
- 依据命令：`grep '"package"' plugins/*/*/package.json`（package 脚本依赖 chips 二进制）；`grep -rl "@chips/cli" tools/scaffold/src/templates/`。
