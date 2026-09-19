# 会话记录：playful-circuit

- 会话 ID：ses_0112118a2ffePoLqVbdM1uWeIo
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-11 11:30:13

---

## 2026-08-11 11:30:13

修复薯片生态 book-BCP 检查发现的所有问题。不做 Git 提交。

## 仓库
/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-BaseCardPlugin/book-BCP

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/03-统一视觉规范（苹果风格设计系统）.md（token：主色 #0a84ff、底色 #f5f5f7、容器 #ffffff、文本 #1d1d1f、次级 #6e6e73、圆角 8~12px、苹方字体、柔和阴影 0 1px 2px rgba(0,0,0,0.04) + 0 4px 12px rgba(0,0,0,0.06)）

## 修复清单（含证据位置）

### 功能
1. **[一般] 封面加载失败兜底失效**：src/render/view.tsx:385 `resolvedUrls.get(coverPath) || coverPath` 与 view.tsx:251 失败写 "" 冲突 → 解析失败/未完成时显示占位（view.tsx:297-301 的占位图标分支），antd Image 加 fallback；不要回退相对路径
2. **[一般] 查看态解析整本书全部图片**：view.tsx:377-382 把 book_file+cover+全部 image_sequence 都 resolve → 只解析封面（和当前展示需要的资源）
3. **[轻微] 解析竞态与释放**：view.tsx:262-269 cleanup 先释放但循环内仍在 resolve → cancelled 标志在循环内每次检查；只对成功解析的路径 release
4. **[轻微] 清理操作未捕获删除失败**：panel.tsx:698-726 clearMainResource/clearCover 的 deleteResource 失败无 try/catch → 加 catch 并提示；handleMainFile 删除失败提示文案修正
5. **[轻微] initialConfig 回推重置本地状态**：panel.tsx:479-481 依赖对象 identity → 改为仅在首次挂载使用 initialConfig（useRef 守卫）
6. **[轻微] book_format 无白名单校验**：src/schema/card-config.ts:151-153 → 加白名单（如 hardcover/paperback/ebook 等，按现有使用口径）
7. **[轻微] ZIP 文件名 UTF-8 标志**：src/shared/archive.ts:33-39 两分支相同 → 按 ZIP general purpose bit 11 判断 UTF-8 解码

### 渲染 UI
8. hover/按压无反馈（view.tsx:67-69）：hover 背景加深（#ebebed）+ 轻微上浮阴影，补 :active 态
9. 懒加载失效：loading="lazy"/draggable={false} 落在 antd Image 包装 div → 用 styles.image 或直接作用于 img
10. Tag 双倍间距（view.tsx:277,151）：antd Tag margin-inline-end 8px + flex gap 8px → Tag margin 覆盖为 0
11. 字体栈补 -apple-system, BlinkMacSystemFont 前缀（view.tsx:28）

### 编辑面板 UI
12. 原生 select → antd Select（panel.tsx:977-987），高度对齐 controlHeight 36px
13. 图片列表加序号 + 条目分隔线（panel.tsx:350-364），缩略图可选（能用已解析 URL 则用）
14. 拖拽 hover 反馈：data-state 加 drag-active 高亮（panel.tsx:255-258,806）

## 红线
- 卡片格式契约不变（schema 字段、onChange 语义、openResource payload）；manifest/capabilities 不变
- 禁止 import @chips/component-library；禁止 any；禁止 TODO
- 禁止删除文件（移动归档）；只改本仓库

## 验证（全部通过才算完成）
1. npx tsc --noEmit → 0 错误
2. npm test → 全绿（更新受影响的测试断言）
3. npm run build → 成功
4. npm run validate → ok
5. 残留扫描：rg "TODO|FIXME|@chips/component-library" src tests → 零命中（归档除外）

## 汇报
- 修复清单（问题→处理方式）
- 验证输出摘要
- 遗留疑问（若有）
