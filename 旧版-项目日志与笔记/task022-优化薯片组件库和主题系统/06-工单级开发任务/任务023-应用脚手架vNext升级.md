# 任务023：应用脚手架 vNext 升级

## 1. 任务目标

升级 `chips-scaffold-app`，让新建应用插件默认具备 App/Scene/surface/commands、View/Modifier、主题、多语言、权限、测试、预览和质量门禁能力。

## 2. 对应阶段任务

- `05-开发任务方案/任务06-应用脚手架vNext默认模板.md`
- `05-开发任务方案/任务25-全类型脚手架升级.md`

## 3. 涉及项目

- `Chips-Scaffold/chips-scaffold-app`
- `Chips-SDK`
- `Chips-ComponentLibrary`
- `Chips-Host`
- `生态共用技术文档/插件开发/02-应用插件开发.md`

## 4. 开发内容

1. 重新核对应用脚手架 `src/`、`templates/`、测试脚本和已生成应用插件。
2. 更新模板目录结构：`app/`、`scenes/`、`views/`、`commands/`、`i18n/`、`tests/`、`preview/`。
3. 默认接入 SDK Runtime Client、React hooks、Environment、ChipsThemeProvider、i18n Provider 与错误边界。
4. 默认生成 `manifest.yaml` 中 `type: app`、`runtime.targets`、权限、surface、commands、theme/i18n 元信息。
5. 默认生成声明式 View 示例：View、Stack、Grid、Form、List、Toolbar、Navigation、Dialog、状态绑定。
6. 默认生成质量门禁：lint、typecheck、test、build、validate、preview smoke。
7. 更新模板测试，验证生成项目可以直接执行 `npm run build/test/lint/validate`。

## 5. 验收标准

- 新应用插件不需要手写底层主题、i18n、Bridge、命令、surface 初始化代码。
- 生成项目与 Host 正式链路一致，不直接访问 Electron/Node。
- 生成项目可作为后续所有应用插件迁移的参考样板。
- 脚手架文档和生态共用应用插件开发文档口径一致。

## 6. 验证命令

```bash
cd Chips-Scaffold/chips-scaffold-app
npm run lint
npm test
npm run test:templates
npm run test:e2e
```

## 7. 注意事项

- 不引入新的独立应用框架项目；能力仍落在现有 Host、SDK、组件库与脚手架。
- 模板不能包含 TODO、占位 UI 或临时兼容层。
- 本任务开发前必须重新核对当前官方应用插件的真实写法和 SwiftUI App/Scene/View 模型。
