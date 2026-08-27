# 会话记录：cosmic-star

- 会话 ID：ses_01dbfe497ffevaII92eBWjDfFg
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:41:19

---

## 2026-08-09 00:41:19

为 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-CardViewer 建立统一动效规范与 reduced-motion 支持。不做 Git 提交。

## 任务（对应建议文档 8.1、8.2、8.3、8.4）
参考 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/Chips-CardViewer细节优化建议.md 的 8.1~8.4 节。

### 实现要点（只改 src/global.css，其他 CSS 由其他子代理负责）
1. **动效变量**（8.1）：在 `:root` 定义：
   ```css
   --chips-motion-duration-fast: 150ms;
   --chips-motion-duration-base: 200ms;
   --chips-motion-duration-slow: 280ms;
   --chips-motion-ease: cubic-bezier(0.25, 0.1, 0.25, 1);
   --chips-motion-ease-in: cubic-bezier(0.4, 0, 1, 1);
   --chips-motion-ease-out: cubic-bezier(0, 0, 0.2, 1);
   ```
2. **reduced-motion 全局规则**（8.2）：在文件末尾：
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
   }
   ```
   （通用覆盖规则，供各组件 CSS 继承生效）
3. **focus-visible 统一**（8.4）：全局按钮/可交互元素 focus 环保持 3px rgba(10,132,255,0.34)（当前各文件已有，写一个通用规则兜底）：
   ```css
   button:focus-visible, [tabindex]:focus-visible {
     outline: 3px solid rgba(10,132,255,0.34);
     outline-offset: 3px;
   }
   ```
4. **不要动**其他 CSS 文件（其他子代理正在并行修改 DropZone.css / CardWindow.css / ViewerChrome.css / CardViewerShell.css，你的变量定义会被它们引用；若它们引用不存在的变量，最终验证时统一修正）

## 文件域（只改这一个文件）
- src/global.css

## 验证
1. 确认 global.css 语法正确（无构建破坏）
2. 汇报：改动清单 + 变量清单（供其他子代理引用）

## 红线
- 禁止 import 任何库；禁止 any；禁止 TODO
- 不改其他任何文件
