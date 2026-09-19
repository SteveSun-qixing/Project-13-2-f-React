# 阶段三：卡片转HTML模块落地

## 目标

完成 `Chips-CardtoHTML-Plugin` 的正式实现，让整个链路先具备可交付的 HTML 导出能力和可复用的目录态 HTML 中间产物。

## 本阶段任务

- 接入 Host `card.render(..., { target: "offscreen-render" })`
- 生成目录态 HTML 中间产物
- 完成资源复制、路径重写与转换清单生成
- 打通 HTML 压缩包输出
- 建立视觉一致性与回归样例

## 完成标准

- 直接导出 HTML 时能得到可离线打开的压缩包
- 作为中间产物时能稳定生成目录态 HTML
- 输出页面与 Host 正式卡片显示结果保持一致
