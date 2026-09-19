# 阶段五：Host / SDK / Bridge / 快捷方式与治理图标链路收口

## 1. 阶段目标

把 Host、SDK、Bridge、PAL 和治理应用所依赖的图标能力边界收口到一致口径，确保系统入口图标与治理状态图标都可正式工作。

## 2. 涉及范围

1. `Chips-Host`
2. `Chips-SDK`
3. `Chips-EcoSettingsPanel`
4. Host / SDK / 治理相关共享文档

## 3. 当前基线

1. Host 已支持 `ui.launcher.icon`；
2. SDK 已暴露 `PluginShortcutRecord.iconPath`；
3. 设置面板未消费图标状态；
4. Host / SDK 文档尚未完整说明“系统入口图标”和“运行时 UI 图标”的分层边界。

## 4. 核心任务

1. 复核 Host 启动图标安装与快捷方式行为；
2. 复核 SDK 图标状态字段和调用口径；
3. 补齐治理页图标消费要求；
4. 明确 Bridge / PAL 的系统图标文件边界；
5. 补齐 Host / SDK / 安装器 / 内置插件相关测试。

## 5. 交付物

1. Host / SDK 文档更新；
2. 设置面板治理图标接线基础；
3. 图标链路相关测试更新。

## 6. 验证

- `cd Chips-Host && npm run build && npm test && npm run test:contract`
- `cd Chips-SDK && npm test`

## 7. 完成判定

只有当 Host / SDK / 治理应用之间对图标字段与职责边界的理解完全一致，本阶段才算完成。
