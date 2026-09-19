# 阶段四：HTML转PDF与图片模块落地

## 目标

完成 `Chips-HtmltoPDF-Plugin` 和 `Chips-HtmltoImage-Plugin`，让 `card -> pdf` 与 `card -> image` 通过 HTML 中间产物正式闭环。

## 本阶段任务

- 冻结目录态 HTML 输入契约
- 完成 Electron 页面加载、稳定等待和输出参数治理
- 实现 PDF 输出
- 实现图片输出
- 与编排模块打通中间目录清理和错误回传

## 完成标准

- `card -> pdf` 与 `card -> image` 都通过正式编排入口可用
- HTML 中间产物不会泄漏到最终用户输出目录
- PDF / 图片输出参数在契约和测试中均可验证
