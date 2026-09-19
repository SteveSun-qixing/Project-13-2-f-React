# 任务026：模块插件脚手架 vNext 升级

## 1. 任务目标

升级 `chips-scaffold-module`，让新建模块插件默认符合 Host 模块能力治理、能力契约、权限、错误码、测试和验证标准。

## 2. 对应阶段任务

- `05-开发任务方案/任务23-模块插件能力契约与运行时迁移.md`
- `05-开发任务方案/任务25-全类型脚手架升级.md`

## 3. 涉及项目

- `Chips-Scaffold/chips-scaffold-module`
- `Chips-ModulePlugin/*`
- `Chips-SDK`
- `Chips-Host`
- `生态共用技术文档/插件开发/05-模块插件开发.md`
- `生态共用技术文档/协议与契约/06-模块能力契约.md`

## 4. 开发内容

1. 重新核对模块插件脚手架模板、测试、生成项目和五个现有模块插件。
2. 默认生成能力定义、输入输出 schema、错误码、能力版本、权限声明和 manifest 能力字段。
3. 默认生成模块调用测试、Host 模拟调用测试、错误路径测试和清理测试。
4. 默认生成开发态 CLI 调用说明，确保可通过 `chipsdev` 验证能力。
5. 将常见模块形态拆成模板选项：纯函数转换、文件转换、图像处理、颜色提取、HTML 渲染。
6. 对齐 SDK module invoke 封装，避免应用插件直接导入模块源码。
7. 更新模板文档，说明模块插件无界面、可替换、可版本治理的边界。

## 5. 验收标准

- 新模块插件具备明确能力契约和错误模型。
- Host 可以通过正式模块路由发现、调用、验证模块能力。
- 生成插件通过 build/test/lint/validate。
- 应用插件只能通过 SDK/Bridge 调用模块，不跨目录 import。

## 6. 验证命令

```bash
cd Chips-Scaffold/chips-scaffold-module
npm run build
npm test
npm run test:templates
npm run test:e2e

cd ../../Chips-SDK
npm test
```

## 7. 注意事项

- 模块插件不创建自己的应用窗口。
- 不为单个现有模块写死特殊模板；模板应服务所有模块能力。
- 本任务开发前必须重新核对 Host 模块加载实现和 SDK CLI 模块测试。
