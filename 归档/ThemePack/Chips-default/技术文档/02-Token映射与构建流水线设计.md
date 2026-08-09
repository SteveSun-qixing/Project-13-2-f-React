# Token 映射与构建流水线设计

> 文档状态：实现基线设计稿  
> 适用范围：`ThemePack/Chips-default` 默认主题包 `src/build-tokens.ts`

---

## 1. 输入源与目标结构

### 1.1 输入源：@chips/tokens

默认主题包的 token 输入源对齐 `Chips-ComponentLibrary/packages/tokens/tokens`：

- `ref.json`：基础色板、圆角、间距等；
- `sys.json`：语义色彩与语义参数；
- `motion.json`：动效时长与缓动；
- `layout.json`：布局密度与间距；
- `comp/*.json`：组件级 token（button/input/dialog/...）。

这些文件内部结构形如：

```json
{
  "chips": {
    "ref": { ... }
  }
}
```

或：

```json
{
  "chips": {
    "comp": {
      "button": {
        "root": { ... },
        "label": { ... }
      }
    }
  }
}
```

### 1.2 目标结构：ThemeTokenLayers

构建后的 `dist/tokens.json` 必须符合 Theme Runtime 的五层结构：

```json
{
  "ref": { ... },
  "sys": { ... },
  "comp": { ... },
  "motion": { ... },
  "layout": { ... }
}
```

由 Host 侧的 `asThemeTokenLayers` 和解析算法负责进一步 flatten 和引用解析。

---

## 2. 构建流程概览

构建流程由 `src/build-tokens.ts` 完成，步骤如下：

1. 读取项目根目录下的 `tokens/ref.json/sys.json/motion.json/layout.json`；
2. 读取 `tokens/comp/` 下所有 `*.json` 文件；
3. 对 `comp` 层执行深度合并（按组件名聚合）；
4. 生成内存中的 `themeTokens = { ref, sys, comp, motion, layout }`；
5. 将 `themeTokens` 写入 `dist/tokens.json`（带缩进，便于调试）。

所有 JSON 解析错误或文件缺失都会导致构建脚本抛错并中止构建。

---

## 3. 组件层合并规则

### 3.1 目录约定

- `tokens/comp/` 目录下，每个组件一个 JSON 文件：
  - `button.json`
  - `input.json`
  - `dialog.json`
  - ...
- 每个文件的结构遵守 @chips/tokens 格式：

```json
{
  "chips": {
    "comp": {
      "button": {
        "root": { ... }
      }
    }
  }
}
```

### 3.2 合并策略

- 读取所有组件 JSON 后，使用“对象深度合并”策略构造最终 `comp` 层：
  - 合并顺序按照文件名排序，保证稳定性；
  - 同一键路径上的值：
    - 如果两个值均为对象，则递归合并；
    - 否则后者覆盖前者；
- 合并后的 `comp` 结构示例：

```json
{
  "chips": {
    "comp": {
      "button": { ... },
      "input": { ... },
      "dialog": { ... },
      "tabs": { ... }
    }
  }
}
```

这样保证后续 flatten 时可以得到所有 `chips.comp.*` 键。

---

## 4. 错误处理与健壮性

构建脚本在以下情况下会抛出错误并终止：

- `tokens/ref.json/sys.json/motion.json/layout.json` 缺失或不是合法 JSON；
- 某个 `tokens/comp/*.json` 文件内容不是对象或缺失 `chips.comp` 根节点；
- 深度合并过程中遇到无法处理的类型（如数组、非对象等）。

这样可以在开发阶段尽早发现 token 配置错误，避免发布无效主题。

---

## 5. 与测试和验证脚本的关系

- `tests/tokens.spec.ts`：
  - 验证 `dist/tokens.json` 中存在 `ref/sys/comp/motion/layout` 五个对象；
  - 验证图标 tone、工具栏密度和 reduced motion 所需公共 token 已进入默认主题 token 源；
- `tests/contract.spec.ts`：
  - 通过 `src/build-contracts.ts` 从组件库正式 contract 生成 `theme-interface.contract.json` 与 `theme-min-functional-set.json`；
  - 验证主题包 contract 产物与组件库正式 contract 基线全部等值；
  - 覆盖缺失 required token 与 `motionConstraints[].tokenKeys` 时的 `ThemeDiagnostic` 定位字段；
- `src/validate-theme.ts`：
  - 作为 `npm run validate:theme` 的入口；
  - 在构建后先校验本包 contract 产物未偏离组件库来源，再生成 `ThemeContractView` 并输出统一 `summary/diagnostics`，便于在 CI 中使用。

上述三个部分与 `build-tokens.ts` 共同构成默认主题包的最小质量门禁。

## 6. Contract 生成边界

默认主题包必须随包携带 `contracts/theme-interface.contract.json` 与 `contracts/theme-min-functional-set.json`，供 Host 安装后读取；但这两个文件不是人工维护源。`src/build-contracts.ts` 通过 `@chips/theme-contracts` 读取 `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/*.contract.json`，生成本包 contract 产物。

生成链路保留 iframe 附加契约、a11y/motion constraints、required/optional token 等公开字段。若组件库新增、重命名或归档 component contract，本主题包必须重新运行 `npm run build:contracts` 并通过 `npm run validate:theme` 与 `npm test`。

## 7. 图标与 Motion Token 同步边界

默认主题包同步消费 `@chips/tokens` 中的公共图标与 motion 基线：

- `tokens/sys.json` 覆盖 `chips.sys.icon.color-*`、`size-*`、`fill-emphasis`、`wght-*`、`grad-*` 与 `opsz`；
- `tokens/motion.json` 覆盖 `duration/easing/delay/stagger/distance/opacity/scale/reduced/scene/overlay/menu/list/drag/theme`；
- `tokens/comp/icon.json`、`toolbar.json`、`menu-bar.json`、`context-menu.json`、`progress.json`、`skeleton.json`、`loading-boundary.json` 提供组件级映射。

这些 token 是公共主题契约的默认外观取值，不在本主题包内定义新的公共 key。新增或改名必须先回到 `Chips-ComponentLibrary/packages/tokens` 与 `生态共用技术文档/`。
