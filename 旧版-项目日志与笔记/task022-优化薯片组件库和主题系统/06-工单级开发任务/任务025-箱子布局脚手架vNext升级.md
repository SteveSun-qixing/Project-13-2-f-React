# 任务025：箱子布局脚手架 vNext 升级

## 1. 任务目标

升级 `chips-scaffold-boxlayout`，让新建箱子布局插件默认符合新框架的布局声明、运行时分页、封面渲染、配置编辑、主题、多语言和验证标准。

## 2. 对应阶段任务

- `05-开发任务方案/任务22-箱子布局插件全量迁移.md`
- `05-开发任务方案/任务25-全类型脚手架升级.md`

## 3. 涉及项目

- `Chips-Scaffold/chips-scaffold-boxlayout`
- `Chips-BoxLayoutPlugin/*`
- `Chips-SDK`
- `Chips-ComponentLibrary`
- `生态共用技术文档/插件开发/04-布局插件开发.md`
- `生态共用技术文档/协议与契约/08-箱子布局运行时契约.md`

## 4. 开发内容

1. 重新核对箱子布局脚手架模板、测试、生成项目、`grid-BLP` 与 `list-BLP`。
2. 默认生成 `layoutDefinition`、`layoutType`、`renderView`、`renderEditor`、schema 和 i18n。
3. 默认接入 `runtime.listEntries`、`renderEntryCover`、`openEntry`、`readBoxAsset`、`prefetchEntries` 等正式能力。
4. 默认生成布局配置编辑器，使用组件库 Form/List/Grid/Toolbar 控件。
5. 默认生成空状态、错误状态、加载状态、分页状态和 cleanup 测试。
6. 默认生成 `manifest.yaml` 中 `type: layout`、`layout.layoutType`、权限、入口和 runtime targets。
7. 更新模板文档，说明 `.box` 中 `layout_configs` 与布局资源保存边界。

## 5. 验收标准

- 新布局插件可以直接被 Host 箱子运行时加载。
- 布局插件不拼接卡片路径、不直接打开应用插件。
- 配置和资源只通过正式上下文与 box runtime 处理。
- 生成插件通过 build/test/templates/e2e。

## 6. 验证命令

```bash
cd Chips-Scaffold/chips-scaffold-boxlayout
npm run build
npm test
npm run test:templates
npm run test:e2e
```

## 7. 注意事项

- 不把网格或列表的业务偏好固化成唯一模板能力。
- 本任务开发前必须重新核对箱子布局插件开发技能、箱子格式规范和 Host box runtime。
