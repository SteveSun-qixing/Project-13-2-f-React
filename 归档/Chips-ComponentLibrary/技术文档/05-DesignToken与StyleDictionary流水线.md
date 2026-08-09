# Design Token 与 Style Dictionary 流水线

## 1. Token 五层模型

组件库采用五层 token 体系：

1. `ref`：原始值（色板、字号、间距）
2. `sys`：语义值（primary/surface/border）
3. `comp`：组件值（button/input/dialog 等）
4. `motion`：动效值（duration/easing）
5. `layout`：布局密度值（gap/radius/density/cpx）

## 2. 源文件结构

```text
packages/tokens/tokens/
  ref.json
  sys.json
  motion.json
  layout.json
  comp/
    card-cover-frame.json
    composite-card-window.json
```

## 3. Style Dictionary 构建产物

必须输出：

- `dist/css/variables.css`：CSS 变量
- `dist/json/tokens.json`：运行时 token 快照
- `dist/ts/token-keys.d.ts`：token key 类型
- `dist/report/token-diff.md`：版本差异报告

## 4. 构建门禁

构建前校验：

- token schema 校验
- 引用链校验（禁止循环引用）
- 必需前缀校验（`ref/sys/motion/layout/comp`）
- 主题契约覆盖校验（组件契约中的 token key 必须存在）

构建失败直接阻断发布，不允许跳过。

当前执行命令：

- `npm run validate:tokens`
- `npm run build:tokens`
- `npm run validate:contracts`
- `npm run verify`

## 5. 命名规范

- 统一前缀：`chips.`
- 层级命名：`chips.<layer>.<domain>.<key>`
- 示例：`chips.sys.color.primary`、`chips.comp.button.height.md`
- Card Runtime 组件示例：`chips.comp.card-cover-frame.border.radius`、`chips.comp.composite-card-window.status.color.error`

## 6. 版本策略

- 新增 token key：minor
- 修改 token 语义且不兼容：major
- 修正文案/注释/非语义信息：patch

## 7. 与主题包关系

- 主题包必须完整覆盖 `sys` 层与所需 `comp` 层
- `ref` 层可按主题特征扩展，但不得破坏核心语义映射
- `motion/layout` 必须包含可访问性安全边界（时长上限、动画降级）

## 8. 当前产物路径

- `packages/tokens/dist/css/variables.css`
- `packages/tokens/dist/json/tokens.json`
- `packages/tokens/dist/ts/token-keys.d.ts`
- `packages/tokens/dist/report/token-diff.md`
