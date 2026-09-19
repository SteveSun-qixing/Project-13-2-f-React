# 任务047：ColorPicker 模块插件迁移

## 1. 任务目标

将 `Chips-ModulePlugin/Chips-ColorPicker` 迁移到新框架模块能力基线，使图片颜色提取成为 Host 托管、可复用、可诊断的正式模块能力。

## 2. 对应阶段任务

- `05-开发任务方案/任务23-模块插件能力契约与运行时迁移.md`

## 3. 涉及项目

- `Chips-ModulePlugin/Chips-ColorPicker`
- `Chips-Host`
- `Chips-SDK`
- `Chips-PhotoViewer`
- `Chips-BaseCardPlugin/image-BCP`

## 4. 开发内容

1. 重新核对 `manifest.yaml` 中 `image.color.pick` capability、schema、`sharp` 依赖和自定义 build 脚本。
2. 升级输入/输出 schema，明确图片路径、采样策略、背景色、主色、调色板和错误码。
3. 确认文件读取只通过模块运行时授权路径或 Host 提供的资源路径进行。
4. 增加大图、透明图、动图、损坏图片和不支持格式的诊断输出。
5. 对齐 SDK module invoke 类型，供图片查看器、主题建议、卡片封面分析等场景复用。
6. 优化性能基线：采样尺寸、内存限制、并发限制和超时取消。
7. 增加 schema、颜色准确性、错误路径、性能和 cleanup 测试。

## 5. 验收标准

- `image.color.pick` 能被 Host 模块运行时发现和调用。
- 模块不绕开权限直接读取任意系统路径。
- 输出颜色数据稳定、可解释、可被主题和应用复用。
- 通过插件 build/test/lint/validate。

## 6. 验证命令

```bash
cd Chips-ModulePlugin/Chips-ColorPicker
npm run lint
npm test
npm run build
npm run validate
```

## 7. 注意事项

- `sharp` 已是当前插件依赖；新增图像依赖仍需先决策。
- 本任务开发前必须重新核对图像颜色提取模块能力契约和当前插件代码。

## 8. 完成记录

- 2026-05-26：完成 ColorPicker 图像颜色提取模块迁移收口。
- 工作日志：`07-工作日志/任务047-ColorPicker模块插件迁移-20260526.md`
- 复核证据：`manifest.yaml` 已声明 `type: module`、`image.color.pick/pick` sync 能力与输入/输出 schema；当前 `package.json` 提供 `lint/test/build/validate` 正式脚本。
- 验证：`npx tsc --noEmit`、`npm test -- --run`、`npm run lint`、`npm run build`、`npm run validate`、模块脚手架验证链路与 `Chips-SDK npm test` 已通过。
- 提交记录：`1e3eba26 完成任务047 ColorPicker模块插件迁移收口`。
