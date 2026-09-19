# 任务021：暗色主题包 Token 与 Contract 升级

## 1. 任务目标

将 `ThemePack/Chips-theme-default-dark` 升级为新框架暗色主题基线，确保它与默认主题拥有同等级 token 覆盖、组件 contract 覆盖和运行时表现质量。

## 2. 对应阶段任务

- `05-开发任务方案/任务14-主题系统与组件Contract治理.md`
- `05-开发任务方案/任务24-主题包全量升级与视觉一致性.md`

## 3. 涉及项目

- `ThemePack/Chips-theme-default-dark`
- `Chips-ComponentLibrary/packages/tokens`
- `Chips-ComponentLibrary/packages/theme-contracts`
- `Chips-Host`
- `生态共用技术文档/主题系统`
- `生态共用技术文档/组件库`

## 4. 开发内容

1. 重新核对暗色主题包现有 `manifest.yaml`、`tokens/`、`styles/`、`contracts/`、测试与历史归档。
2. 按默认主题同一份组件 contract 补齐暗色 `chips.comp.*` token。
3. 重新设计暗色 `sys` 颜色层，覆盖窗口背景、surface、菜单、工具栏、表单、弹层、焦点环、危险/警告/成功状态。
4. 校准暗色主题下的可读性、对比度、禁用态、悬停态、按下态、选中态和错误态。
5. 确保图标字体、motion CSS、component CSS 与默认主题保持结构一致。
6. 增加暗色主题矩阵测试：应用窗口、卡片 iframe、箱子布局、设置面板、预览面板、性能诊断面板。
7. 同步更新暗色主题包内部文档；公共规则变化同步到生态共用技术文档。

## 5. 验收标准

- 暗色主题与默认主题 contract 覆盖数量一致。
- 所有组件在暗色主题下无缺失变量、无低对比度关键状态、无浅色残留。
- Host 主题切换后应用窗口、卡片、箱子、弹层和菜单视觉同步刷新。
- 暗色主题可以作为独立 `themeId` 正式启用。

## 6. 验证命令

```bash
cd ThemePack/Chips-theme-default-dark
npm run build
npm run validate:theme
npm test

cd ../../Chips-ComponentLibrary
npm run validate:contracts
npm run quality:gate
```

## 7. 注意事项

- 暗色外观必须作为独立主题包存在，不在默认主题包内做 light/dark 分支。
- 不允许应用插件为了适配暗色主题写本地皮肤分支。
- 本任务开发前必须重新核对当前 Host 主题切换链路和组件库 contract，不能只复制默认主题 token。
