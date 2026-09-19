# 任务16：Web 项目同化 CLI 与迁移报告

## 1. 任务目标

建立外部 Web 项目同化能力，让薯片生态可以快速吸收 React/Vite/静态 Web 项目，并逐步改造成符合薯片 manifest、surface、Bridge、主题、多语言、组件库和质量门禁的应用插件。

这项能力优先作为 SDK/Scaffold CLI 工具链落地，不默认新建独立项目。

## 2. 当前基础

已核对：

- `OpenSourceProjectHandlingFolder/` 中已有外部项目处理空间。
- `Chips-SDK/cli/index.js`
- `Chips-Scaffold/chips-scaffold-app`
- `生态共用技术文档/插件开发/02-应用插件开发.md`
- `生态共用技术文档/插件开发/06-Manifest配置规范.md`

当前没有正式工具链自动分析外部 Web 项目，迁移仍依赖人工判断。

## 3. 涉及项目

- `Chips-SDK`
- `Chips-Scaffold/chips-scaffold-app`
- `OpenSourceProjectHandlingFolder`
- `Chips-ComponentLibrary`
- `生态共用技术文档/插件开发/*`

## 4. 开发内容

1. 项目识别。
   - React。
   - Vite。
   - 静态 HTML。
   - 传统 SPA。
   - 组件库型项目。
   - Electron/Web 混合项目。

2. manifest 生成/补齐。
   - `type: app`。
   - `entry`。
   - `runtime.targets`。
   - `ui.surface`。
   - permissions 初步推断。
   - capabilityFallbacks。

3. 系统能力扫描。
   - 直接 Node/Electron API。
   - localStorage/sessionStorage。
   - fetch/network。
   - file input/download。
   - window.open。
   - clipboard。
   - keyboard shortcut。

4. 薯片接线建议。
   - Bridge/SDK 替换建议。
   - surface 打开方式。
   - resource/file/config/theme/i18n 对接建议。
   - command/navigation 接线建议。

5. 样式同化扫描。
   - 硬编码颜色。
   - 硬编码字体。
   - 硬编码圆角/阴影。
   - 暗色模式私有实现。
   - token 迁移建议。

6. 多语言扫描。
   - 用户可见文本提取。
   - 生成 i18n key 建议。
   - 检查硬编码中文/英文。

7. 组件替换建议。
   - button/input/select/dialog/menu/tabs/table/list 等基础控件识别。
   - 给出 Chips 组件替换表。

8. 迁移报告。
   - 同化评分。
   - 必须修复项。
   - 建议修复项。
   - 可自动生成项。
   - 风险项。
   - 后续人工任务清单。

## 5. 建议文件范围

- `Chips-SDK/cli/index.js`
- `Chips-SDK/src/tooling/*`
- `Chips-SDK/tests/*`
- `Chips-Scaffold/chips-scaffold-app/src/*`
- `Chips-Scaffold/chips-scaffold-app/templates/*`
- `OpenSourceProjectHandlingFolder/*`

## 6. 验收标准

- 能对一个 React/Vite 项目生成迁移报告。
- 能生成初版 app 插件 manifest。
- 能识别硬编码样式和文案。
- 能输出 SDK/Bridge 接线建议。
- 不把外部项目简单塞进 iframe 当作完成。

## 7. 验证命令

```bash
cd Chips-SDK && npm test
cd Chips-Scaffold/chips-scaffold-app && npm run build && npm test && npm run test:e2e
```

建议选取 `OpenSourceProjectHandlingFolder/` 中一个项目做手动同化演练，并保存报告。

## 8. 依赖任务

- 依赖：[任务06-应用脚手架vNext默认模板.md](./任务06-应用脚手架vNext默认模板.md)
- 依赖：[任务14-主题系统与组件Contract治理.md](./任务14-主题系统与组件Contract治理.md)
- 依赖：[任务15-预览组件矩阵主题矩阵与性能工具.md](./任务15-预览组件矩阵主题矩阵与性能工具.md)

## 9. 风险与注意事项

- 不要自动改写大规模外部代码而没有报告和回滚边界。
- 不要引入新解析库，除非先确认技术选型。
- 不要生成不符合薯片规范的临时插件。

