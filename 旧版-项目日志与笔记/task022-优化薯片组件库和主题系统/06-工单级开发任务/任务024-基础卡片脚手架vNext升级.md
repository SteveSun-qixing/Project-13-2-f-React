# 任务024：基础卡片脚手架 vNext 升级

## 1. 任务目标

升级 `chips-scaffold-basecard`，让新建基础卡片插件默认符合新框架的 View/Modifier、组件库、主题、多语言、资源、编辑器、渲染和验证标准。

## 2. 对应阶段任务

- `05-开发任务方案/任务21-基础卡片插件全量迁移.md`
- `05-开发任务方案/任务25-全类型脚手架升级.md`

## 3. 涉及项目

- `Chips-Scaffold/chips-scaffold-basecard`
- `Chips-BaseCardPlugin/*`
- `Chips-SDK`
- `Chips-ComponentLibrary`
- `生态共用技术文档/插件开发/03-卡片插件开发.md`

## 4. 开发内容

1. 重新核对基础卡片脚手架模板、测试、生成项目、现有八个基础卡片插件。
2. 默认生成 `renderBasecardView`、`renderBasecardEditor`、`basecardDefinition` 和 schema 目录。
3. 默认生成 config normalize/validate、resource collect、默认配置、错误态与空态。
4. 默认接入组件库表单控件、资源导入控件、预览控件、主题 token 和 i18n 文件。
5. 默认通过上下文回调调用 `importResource`、`resolveResourceUrl`、`deleteResource`、`releaseResourceUrl`、`openResource`。
6. 默认生成 renderer/editor mount 与 cleanup 测试。
7. 更新生成项目的 `manifest.yaml`，确保 `capabilities.cardTypes`、`runtime.targets`、入口和权限准确。

## 5. 验收标准

- 新基础卡片插件可以直接被编辑引擎和查看器加载。
- 资源路径只保存 card-root 相对路径，不保存绝对路径、blob、data 或临时 URL。
- 模板使用 React、主题 token、多语言、正式 Bridge/SDK 链路。
- 生成插件通过 build/test/lint/validate。

## 6. 验证命令

```bash
cd Chips-Scaffold/chips-scaffold-basecard
npm run build
npm test
npm run test:templates
npm run test:e2e
```

## 7. 注意事项

- 如果脚手架与现有卡片插件最佳实践冲突，先登记工单再修改公共模板。
- 不把具体业务卡片逻辑写进脚手架；脚手架只提供正式结构和最小示例。
- 本任务开发前必须重新核对基础卡片插件开发技能、卡片文件规范和 Host 渲染链路。
