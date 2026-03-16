# {{ DISPLAY_NAME }}

> 通过 `chips-scaffold-basecard` 生成的文本型基础卡片插件工程。

## 简介

本插件工程实现了一个面向纯文本内容的基础卡片插件（`type: card`），用于演示如何：

- 在查看器中以标题 + 正文的形式渲染文本内容；
- 在编辑引擎中提供对应的编辑面板；
- 向 Host 导出正式基础卡片契约，用于会话打开、配置归一、校验与资源收集；
- 使用 YAML 配置文件保存文本内容；
- 使用多语言文案与基础错误处理。

## 项目结构

```text
{{ PROJECT_NAME }}/
├─ .eslintrc.cjs
├─ manifest.yaml
├─ package.json
├─ tsconfig.json
├─ chips.config.mjs
├─ src/
│  ├─ index.ts
│  ├─ runtime-contract.ts
│  ├─ render/
│  │  ├─ view.tsx
│  │  └─ runtime.ts
│  ├─ editor/
│  │  ├─ panel.tsx
│  │  └─ runtime.ts
│  ├─ schema/
│  │  └─ card-config.ts
│  └─ shared/
│     └─ utils.ts
├─ config/
│  └─ logging.ts
├─ i18n/
│  ├─ zh-CN.json
│  └─ en-US.json
├─ templates/
│  ├─ default-card-config.yaml
│  └─ parameters.md
├─ tests/
│  ├─ unit/
│  │  ├─ render-view.test.tsx
│  │  └─ editor-panel.test.tsx
│  └─ integration/
│     └─ card-flow.test.ts
└─ assets/
   └─ icons/
      └─ basecard-icon.svg
```

## 快速开始

```bash
cd <生态根工作区>
npm install
cd {{ PROJECT_NAME }}
npm run dev
```

文本型基础卡片模板同样依赖生态根工作区提供 `chips-sdk` 与 `chipsdev`，不得在项目目录单独维护一套临时依赖链路。

## 配置结构

文本型基础卡片配置类型在 `src/schema/card-config.ts` 中定义，对应 YAML 文件示例位于 `templates/default-card-config.yaml`。

## Host 正式契约

- 基础卡片插件必须通过 `src/runtime-contract.ts` 导出正式契约；
- Host 只按 `manifest.yaml` 中声明的正式 `{{ CARD_TYPE }}` 路由插件；
- 不保留旧类型别名、兼容回退或隐式归一逻辑。
