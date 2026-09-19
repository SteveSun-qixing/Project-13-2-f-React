# 任务021-暗色主题包 Token 与 Contract 升级

时间：2026-05-24 18:25 CST

## 本次完成

- 复核任务021、主题包全量升级方案、暗色主题预研报告、生态设计原稿、主题系统公共规范和 ThemePack/组件库目录规则。
- 暗色主题包新增 `src/build-contracts.ts`，通过 `@chips/theme-contracts` 从组件库正式 component contract 生成：
  - `contracts/theme-interface.contract.json`
  - `contracts/theme-min-functional-set.json`
- 暗色主题 `npm run build` 改为依次执行 `build:tokens`、`build:contracts`、`build:css`。
- 暗色主题 `validate:theme` 改为通过 `@chips/theme-contracts` public API 执行：
  - required token 覆盖校验；
  - `theme-interface.contract.json` 与组件库正式 contract 等值比对；
  - `theme-min-functional-set.json` 与组件库正式 contract 集合比对。
- 暗色主题 `styles/components/*.css` 拼接前按文件名排序，保证 CSS 构建输出稳定。
- 暗色主题补齐命令消费组件正式 CSS 覆盖：
  - `toolbar`
  - `menu-bar`
  - `context-menu`
  - `shortcut`
- 暗色主题重新校准 `ref/sys` 状态色：
  - 新增 `success / warning / info / danger / error`；
  - 新增对应 `*-surface` 和 `*-contrast`；
  - 保持暗色画布、表面、焦点环、边框、阴影等语义层级。
- 暗色主题组件 token 使用更明确的状态语义：
  - `badge` 的 success/warning/error 不再复用 primary/surface；
  - `tag` 错误态使用 `error-surface/error`；
  - `toolbar/menu-bar/context-menu/shortcut` 使用暗色表面层级、`info-surface` 与 `focus-ring`；
  - `spinner/loading-boundary/skeleton` 信息态使用 `chips.sys.color.info`。
- 组件库公共 token 源新增生态公开状态色 key，并同步 token 测试和 README。
- 默认主题同步公共状态色 key 与 `badge` token，避免公共 token source 与官方主题之间产生漂移。
- 新增暗色主题矩阵 `preview/theme-matrix.json`，覆盖应用窗口、基础卡片 iframe、箱子布局 iframe、模块配置面板四类运行时场景。
- 暗色主题测试增强：
  - contract 从组件库 source of truth 生成并保持等值；
  - CSS 覆盖每个正式 component contract scope；
  - 暗色状态色 key 与关键组件 token 映射存在；
  - 暗色关键文本/状态色对比度满足 4.5:1；
  - 主题矩阵引用真实 contract scope。
- 更新公共文档：
  - `生态共用技术文档/主题系统/01-主题包开发指南.md`
  - `生态共用技术文档/组件库/03-Token与主题对接标准.md`
- 更新暗色主题包内部技术/需求/开发计划文档，修正旧路径、46 组件旧口径、构建脚本和 contract 漂移门禁说明。
- 接收并关闭任务022预研子代理；预研报告已保存到 `08-草稿笔记/任务022-主题包图标字体与Motion升级-预研报告-20260524.md`。

## 验证结果

```bash
cd ThemePack/Chips-theme-default-dark
npm run build && npm run validate:theme && npm test
```

- 通过。
- contract 生成：70 component contracts。
- 主题校验：70 components，630 required tokens。
- Vitest：6 files，16 tests passed。

```bash
cd ThemePack/Chips-default
npm run build && npm run validate:theme && npm test
```

- 通过。
- contract 生成：70 component contracts。
- 主题校验：70 components，630 required tokens。
- Vitest：5 files，12 tests passed。

```bash
cd Chips-ComponentLibrary
npm run validate:tokens && npm run build:tokens && npm run validate:contracts && node scripts/validate-official-theme-contracts.mjs
```

- 通过。
- token 校验/构建：696 keys。
- component contract 校验：70 contracts。
- 官方默认/暗色主题随包 contract 与组件库 contract 匹配：70 component contracts。

```bash
cd Chips-ComponentLibrary
npm run quality:gate
```

- 通过。
- lint：215 files。
- typecheck：57 files。
- test / test:contracts / test:a11y / test:perf / quality:coverage / build 全部通过。
- perf：render p95 max=0.6788ms，theme p95=9.3833ms，longTaskRatio=0。
- 新报告：
  - `reports/quality-gate/quality-gate-2026-05-24T101834923Z.json`
  - `reports/quality-gate/component-quality-coverage-2026-05-24T101834589Z.json`
  - `reports/perf/perf-stage9-2026-05-24T101834522Z.json`

## 注意事项

- 本任务没有修改 Host/SDK 运行时逻辑；暗色主题仍只提供 token、CSS、字体资源与随包 contract。
- `dist/` 是忽略目录，本次以构建脚本和验证结果为准，不纳入 git。
- `Chips-ComponentLibrary/reports/*latest.json` 和本轮时间戳报告作为质量门禁证据纳入提交。
- worktree 中仍有与任务021无关的既有未提交文件，未纳入本次提交：
  - `Chips-Scaffold/chips-scaffold-basecard/node_modules/@types/node/*`
