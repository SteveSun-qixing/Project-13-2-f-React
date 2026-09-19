# 任务14：主题系统与组件 Contract 治理

## 1. 任务目标

把主题包、组件库 contract、Host Theme Runtime、L9 主题解析、生态设置面板治理能力打通，形成可验证、可诊断、可展示的设计系统治理闭环。

## 2. 当前基础

已核对：

- `生态共用技术文档/主题系统/01-主题包开发指南.md`
- `生态共用技术文档/主题系统/02-主题接口规范.md`
- `生态共用技术文档/组件库/03-Token与主题对接标准.md`
- `Chips-Host/src/main/theme-runtime/*`
- `Chips-ComponentLibrary/packages/theme-contracts/*`
- `ThemePack/Chips-default/contracts/*`
- `ThemePack/Chips-theme-default-dark/contracts/*`
- `ThemePack/*/tokens/comp/*`

当前主题链路已经有较多基础，但组件增量、contract、主题包、设置面板展示之间还需要治理工具闭环。

## 3. 涉及项目

- `Chips-Host`
- `Chips-ComponentLibrary`
- `ThemePack/*`
- `Chips-EcoSettingsPanel`
- `生态共用技术文档/主题系统/*`
- `生态共用技术文档/组件库/*`

## 4. 开发内容

1. contract schema 治理。
   - 组件 scope。
   - part。
   - state。
   - required tokens。
   - optional tokens。
   - a11y constraints。
   - motion constraints。

2. 组件库生成 contract。
   - 每个组件导出 metadata。
   - contract validator 能校验新增组件。
   - testing 包能断言 `data-scope/data-part/data-state`。

3. 主题包同步。
   - 默认主题补齐所有 required token。
   - 暗色主题补齐所有 required token。
   - token 命名与组件 contract 一致。
   - 一包一外观，不混合 light/dark。

4. Host Theme Runtime 接入。
   - `theme.contract.get` 输出完整 contract view。
   - `theme.apply` 前校验 contract。
   - `theme.resolve` 输出 token 诊断。

5. 生态设置面板治理。
   - 展示已安装主题。
   - 展示组件 contract 覆盖率。
   - 展示 token 缺失和冲突。
   - 展示主题矩阵预览入口。

6. 文档沉淀。
   - 更新组件库公共文档。
   - 更新主题包开发指南。
   - 更新主题接口规范。

## 5. 建议文件范围

- `Chips-ComponentLibrary/packages/theme-contracts/src/validator.js`
- `Chips-ComponentLibrary/packages/theme-contracts/tests/*`
- `Chips-ComponentLibrary/packages/components/src/index.js`
- `ThemePack/*/contracts/*.json`
- `ThemePack/*/tokens/comp/*.json`
- `ThemePack/*/src/validate-theme.ts`
- `Chips-Host/src/main/theme-runtime/*`
- `Chips-Host/tests/unit/theme-runtime.test.ts`
- `Chips-EcoSettingsPanel/src/*`

## 6. 验收标准

- 每个正式组件都有 contract。
- 默认主题和暗色主题 contract 校验通过。
- Host 切换主题前能阻断无效主题。
- 生态设置面板能展示 contract 覆盖与诊断。
- 公共文档同步更新。

## 7. 验证命令

```bash
cd Chips-ComponentLibrary && npm run test:contracts && npm run quality:gate
cd ThemePack/Chips-default && npm test
cd ThemePack/Chips-theme-default-dark && npm test
cd Chips-Host && npm run build && npm test && npm run test:contract
cd Chips-EcoSettingsPanel && npm run verify
```

## 8. 依赖任务

- 依赖：[任务08-SwiftUI对标控件清单与基础控件补齐.md](./任务08-SwiftUI对标控件清单与基础控件补齐.md)
- 依赖：[任务09-复杂组件Compound-API与样式契约.md](./任务09-复杂组件Compound-API与样式契约.md)
- 依赖：[任务13-动画动效与Motion-Token.md](./任务13-动画动效与Motion-Token.md)

## 9. 风险与注意事项

- 不要让主题包发明新协议。
- 不要让组件库写视觉默认皮肤。
- 不要只校验默认主题，暗色主题必须同步覆盖。

