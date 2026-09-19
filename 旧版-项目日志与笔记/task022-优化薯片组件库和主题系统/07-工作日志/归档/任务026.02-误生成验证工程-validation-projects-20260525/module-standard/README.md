# Module Standard

> 通过 `chips-scaffold-module` 生成的标准模块插件工程。

## 简介

本工程面向 `type: module` 的共享功能模块开发。模块插件是安装到 Host 中的无界面能力模块，不创建窗口，不承载页面渲染，不以 DOM 挂载作为正式边界。

模板默认提供以下基线：

- 冻结后的 `manifest.module` 结构；
- `capability + method` 形式的能力定义；
- 同步方法与异步任务方法基线；
- 输入输出 schema 契约文件；
- 单元测试、构建、校验与打包脚本。

## 项目结构

```text
module-standard/
├─ .eslintrc.cjs
├─ manifest.yaml
├─ package.json
├─ tsconfig.json
├─ chips.config.mjs
├─ contracts/
│  ├─ run.input.schema.json
│  ├─ run.output.schema.json
│  ├─ runAsync.input.schema.json
│  └─ runAsync.output.schema.json
├─ src/
│  └─ index.ts
└─ tests/
   └─ unit/
      └─ module-definition.test.ts
```

## 快速开始

```bash
cd <生态根工作区>
npm install
cd module-standard
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

模块插件工程应通过 `chipsdev create module` 接入生态工作区，不再单独手工拼装依赖。若工程位于生态根工作区内，`chipsdev create` 会自动完成工作区注册与 `volta.extends` 写入。

`npm run verify` 会依次执行 lint、typecheck、test、build、validate 和 package。发布或进入开发工作区联调前至少运行一次 `npm run verify`。

## 默认能力定义

模板默认声明一个 capability：

- `module.module.standard`

并提供两个方法：

- `run`：同步执行，直接返回结果；
- `runAsync`：异步任务模式，使用 `ctx.job.reportProgress(...)` 汇报进度。

你应根据实际业务替换 capability、方法名与 schema 文件，但要保持：

- Manifest 中 `module.provides` 与仓库中的 contract 文件一致；
- 模块访问 Host 正式服务动作时使用 `ctx.host.invoke(...)`；
- 模块之间调用统一使用 Host 注入的 `ctx.module.invoke(...)`；
- 不自行实现第二套模块加载器或通信通道。

## 正式约束

- `manifest.yaml` 必须保持 `type: module` 且 `entry: dist/index.mjs`；
- 模块正式能力契约必须写在 `module.provides` 中，而不是旧 `capabilities` 主入口；
- 调用方统一通过 `module.listProviders / module.resolve / module.invoke / module.job.*` 使用模块能力；
- 模块运行时只负责能力实现，不生成任何 UI 运行时、插槽挂载入口或主题注入逻辑；
- 模块访问 Host 服务动作应使用 `ctx.host.invoke(...)`，不得依赖手写服务封装；
- 如果模块需要调用其他模块，只能使用 Host 注入的 `ctx.module.invoke(...)`；
- 每次功能迭代后应同步更新 README 与测试/契约资料，避免把文档目录当作模板产物。
