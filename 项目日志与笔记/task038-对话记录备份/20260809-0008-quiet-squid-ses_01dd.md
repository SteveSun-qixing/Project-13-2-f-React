# 会话记录：quiet-squid

- 会话 ID：ses_01dde3c53ffel1dZV8PSC5fiwv
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:08:11

---

## 2026-08-09 00:08:11

将薯片生态全部 BCP（8 个）与 BLP（10 个）编辑面板/渲染视图的 UI 细节对齐 Cupertino（iOS/macOS 原生）风格。不做 Git 提交。

## 背景
共享层 @chips/ui 已升级 Cupertino 体系（iOS 灰阶 #f2f2f7 输入底、分组列表、Large Title、胶囊搜索、毛玻璃弹层、iOS 开关/滑块等），antd 控件经 appleTheme 自动生效。你的任务是清理各插件中**与 Cupertino 冲突的自定义样式**，只改视觉，不改卡片/箱子数据模型与业务逻辑。

## 处理仓库
- BCP（8 个）：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-BaseCardPlugin/{book,hyperlink,image,music,richtext,score,video,webpage}-BCP
- BLP（10 个）：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-BoxLayoutPlugin/{cardStack,coverFlow,documentLibrary,grid,infiniteCanvas,list,map,masonry,scattered,timeline}-BLP

## Cupertino 视觉基准（冲突即修）
- 编辑面板输入类控件：底 #f2f2f7、圆角 10、聚焦白底 + 3px 蓝环（antd 已自动生效；只检查插件自绘控件与 CSS 覆盖）
- 语义色：成功 #34c759 / 警告 #ff9f0a / 错误 #ff3b30 / 主色 #0a84ff / 文本 #1d1d1f / 次要 #6e6e73
- 按钮：白底灰边、hover 浅灰；主操作蓝
- 弹窗/菜单：白底圆角 12-14 + 柔和阴影
- **渲染视图（render/view）是卡片在查看器中的外观**：只统一语义色（错误/警告/主色），不改变布局与 DOM 语义

## 执行步骤
1. 对每个插件：扫描 src/ 下 .css 与内联样式，查找冲突色值（#2563eb/#d92d20/#f59e0b/#1d4ed8/#e11d48/#16a34a/#dc2626 等）与旧 hover/阴影/圆角
2. 修正为 Cupertino 基准；**布局与数据模型不动**
3. 检查自绘控件（原生 form 里的 button/input/select）：视觉对齐（圆角/灰底/hover），不改事件逻辑与 onChange 语义
4. 每插件验证

## 红线
- 只改 CSS 与视觉内联样式；**禁止改卡片/箱子数据模型、schema、capabilities、渲染 DOM 语义、onChange 语义**
- 禁止引入新依赖；禁止 any；禁止 TODO；禁止删除文件（移动归档）
- 禁止改动共享层/其他仓库

## 验证（每插件目录执行）
1. npx tsc --noEmit → 0 错误
2. npm test → 全绿
3. npm run build → 成功
4. 残留检查：rg "#2563eb|#d92d20|#f59e0b|#1d4ed8|#e11d48|#16a34a|#dc2626" src → 零命中

## 汇报（最终消息必须包含）
- 每个插件修改文件清单（可合并摘要）
- 每插件验证输出摘要（异常才详列）
- 遗留疑问（若有）
