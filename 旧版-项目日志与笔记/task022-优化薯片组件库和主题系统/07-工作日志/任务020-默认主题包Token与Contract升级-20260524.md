# 任务020-默认主题包 Token 与 Contract 升级

时间：2026-05-24 17:55 CST

## 本次完成

- 复核任务020、主题系统与组件 Contract 治理方案、默认主题包预研报告、ThemePack/组件库/公共文档规则。
- 将 `@chips/theme-contracts` 扩展为官方主题 contract 产物的公共生成与比对入口：
  - `loadComponentContracts`
  - `buildThemeInterfaceContract`
  - `buildThemeMinFunctionalSet`
  - `compareThemeInterfaceContract`
  - `compareThemeMinFunctionalSet`
- 默认主题包新增 `src/build-contracts.ts`，由组件库正式 `components/*.contract.json` 生成：
  - `contracts/theme-interface.contract.json`
  - `contracts/theme-min-functional-set.json`
- 默认主题包 `npm run build` 改为依次执行 token、contract、CSS 构建；`validate:theme` 改为通过 `@chips/theme-contracts` 比对组件库来源，发现本地随包 contract 漂移时直接失败。
- 默认主题包补齐命令消费组件 CSS 覆盖：
  - `toolbar`
  - `menu-bar`
  - `context-menu`
  - `shortcut`
- 默认主题包构建链路补齐确定性：
  - `styles/components/*.css` 拼接前排序。
  - `@chips/theme-contracts` 以本仓 `file:` 依赖声明进入默认主题包与根 workspace lock。
- 组件库 `chips.sys.icon.*` 正式进入公共 token 源，默认主题包不再成为公共图标 token key 的唯一来源。
- 默认主题包新增主题矩阵草案 `preview/theme-matrix.json`，覆盖应用插件窗口、基础卡片 iframe、箱子布局 iframe、模块配置面板四类消费场景。
- 默认主题包新增/更新测试：
  - contract 从组件库生成并保持等值。
  - min functional set 与组件库 component contract 集合一致。
  - CSS 覆盖每个正式 component contract scope。
  - 主题矩阵结构有效。
- 因公共 comparator 开始校验 iframe 附加契约，同步暗色主题随包 `theme-interface.contract.json` 的 iframe 元数据，范围仅限 contract 产物一致性；暗色主题 token/CSS 视觉升级仍留到任务021。
- 更新公共文档：
  - `生态共用技术文档/组件库/02-组件契约标准.md`
  - `生态共用技术文档/组件库/03-Token与主题对接标准.md`
  - `生态共用技术文档/主题系统/01-主题包开发指南.md`
  - `生态共用技术文档/主题系统/02-主题接口规范.md`
  - `生态共用技术文档/主题系统/03-图标与字体系统设计规范.md`
- 更新默认主题包内部技术文档：
  - `ThemePack/Chips-default/技术文档/00-文档索引.md`
  - `ThemePack/Chips-default/技术文档/01-默认主题包技术架构与集成说明.md`
  - `ThemePack/Chips-default/技术文档/02-Token映射与构建流水线设计.md`
  - `ThemePack/Chips-default/技术文档/03- CSS与组件对接规范.md`
  - `ThemePack/Chips-default/技术文档/04- 测试策略与质量门禁设计.md`

## 验证结果

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
- token 校验/构建：679 keys。
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
- perf：render p95 max=0.6117ms，theme p95=9.6159ms，longTaskRatio=0。
- 新报告：
  - `reports/quality-gate/quality-gate-2026-05-24T095212529Z.json`
  - `reports/quality-gate/component-quality-coverage-2026-05-24T095212193Z.json`
  - `reports/perf/perf-stage9-2026-05-24T095212131Z.json`

```bash
cd ThemePack/Chips-theme-default-dark
npm run build && npm run validate:theme && npm test
```

- 通过。
- 主题校验：70 components，630 required tokens。
- Vitest：5 files，10 tests passed。

## 注意事项

- 本任务没有修改 Host/SDK 运行时逻辑；主题包仍只提供 token、CSS 和随包 contract。
- `ThemePack/Chips-default/dist/` 与暗色主题 `dist/` 是忽略目录，本次以构建脚本和验证结果为准，不纳入 git。
- `ThemePack/Chips-default/.cpk-stage/` 不是当前 `chipsdev package` 正式输入；本次未同步 `.cpk-stage` 快照，后续若要保留该目录，应在打包任务中统一归档或改为由正式打包命令生成。
- worktree 中仍有与任务020无关的既有未提交文件，未纳入本次提交：
  - `Chips-Scaffold/chips-scaffold-basecard/node_modules/@types/node/*`
