# 文件基础卡片

> 基础卡片插件工程（`Chips-BaseCardPlugin/file-BCP`）。

## 简介

本插件实现文件基础卡片（正式类型 `base.file`），用于在复合卡片中保存任意文件：

- 查看态左侧展示文件封面：优先消费配置中的自定义封面，其次按文件后缀使用插件内置的类别默认封面，仍未命中时回退为中间带后缀文字的文件图标占位；
- 查看态右侧展示两行信息：上行为文件名，下行为文件后缀；
- 查看态点击卡片时通过宿主 `openResource(...)` 表达“打开该文件”的意图，由 Host 统一路由：命中生态内资源处理器时由对应插件打开，未命中时回退系统默认打开方式；
- 编辑态仅提供上传文件区域与“删除文件”操作，文件名与后缀在上传后自动识别，没有任何手工编辑字段。

## 项目结构

```text
file-BCP/
├─ .eslintrc.cjs          # 工程级 ESLint 配置（供 chipsdev-r lint 调用）
├─ manifest.yaml          # 插件清单（type: card，capabilities.cardTypes: [base.file]）
├─ package.json           # NPM 配置
├─ tsconfig.json          # TypeScript 配置
├─ vitest.config.mts      # 测试配置
├─ chips.config.mjs       # chipsdev-r 构建配置
├─ src/
│  ├─ index.ts            # 插件入口（renderBasecardView / renderBasecardEditor / basecardDefinition）
│  ├─ lib/
│  │  └─ messages.ts      # 简体中文文案总表与 formatMessage
│  ├─ render/
│  │  ├─ view.tsx         # 查看态：封面回退链、文件名/后缀展示、打开意图
│  │  └─ runtime.ts       # 查看态挂载与清理
│  ├─ editor/
│  │  ├─ panel.tsx        # 编辑态：上传识别、删除文件
│  │  └─ runtime.ts       # 编辑态挂载与清理
│  ├─ schema/
│  │  └─ card-config.ts   # 配置 Schema、归一与校验
│  └─ shared/
│     ├─ file-types.ts    # 后缀类别映射、MIME 推断
│     ├─ default-covers.ts# 类别默认封面资源映射
│     └─ utils.ts         # 共享工具函数
├─ config/
│  └─ logging.ts          # 日志封装
├─ templates/
│  ├─ default-card-config.yaml  # 默认基础卡片配置模板
│  └─ parameters.md       # 参数表与填写说明
├─ tests/
│  ├─ unit/
│  │  ├─ schema.test.ts
│  │  ├─ render-view.test.tsx
│  │  └─ editor-panel.test.tsx
│  └─ integration/
│     └─ card-flow.test.ts
└─ assets/
   ├─ icons/              # 插件静态身份图标（svg/png/ico/icns）
   └─ covers/             # 文件类别默认封面 SVG 与来源说明
```

## 快速开始

```bash
cd <生态根工作区>
npm install
cd Chips-BaseCardPlugin/file-BCP
npm run verify
```

`chips-sdk`、`chipsdev-r` 与 `@chips/ui` 统一依赖生态根工作区解析。开发调试通过 `chipsdev-r` 在 Host 开发工作区安装启用本插件后进行。

## 配置结构

配置类型定义见 `src/schema/card-config.ts`，字段说明见 `templates/parameters.md`：

```ts
interface BasecardConfig {
  card_type: "base.file";
  theme?: string;
  file_file: string;       // 文件资源（卡片根目录相对路径，必填）
  file_name: string;       // 展示用文件名（自动识别）
  file_extension: string;  // 展示用后缀（自动识别）
  cover_image: string;     // 可选自定义封面（卡片根目录相对路径）
}
```

## 封面回退链

1. `cover_image` 自定义封面：通过宿主 `resolveResourceUrl(...)` 解析；
2. 类别默认封面：`src/shared/file-types.ts` 将后缀映射为 document / spreadsheet / presentation / archive / audio / video / image / text / code 九个类别，对应 `assets/covers/file-cover-<category>.svg`；
3. 图标占位：未登记任何类别的后缀（或无后缀）显示文件图标，图标中间展示后缀前 4 个字符的大写文字。

## 打开链路

- 查看态点击整卡（宿主提供 `openResource` 时整卡为按钮）；
- `resourceId` 为 `file_file` 卡片根目录相对路径，`mimeType` 由后缀内置映射表推断，`title` 为文件名，`fileName` 为含后缀的完整文件名；
- 不传业务 payload：文件打开完全由 Host 按 `resource-handler / file-handler` 能力与扩展名推断路由，基础卡片不猜测目标应用。

## 验证链路

- `npm run lint`：ESLint 检查；
- `npm run typecheck`：TypeScript 严格类型检查；
- `npm test`：Vitest 单元与集成测试；
- `npm run build`：chipsdev-r 正式构建；
- `npm run validate`：Manifest 与产物契约校验；
- `npm run package`：生成 `.cpk` 插件包；
- `npm run verify`：串联以上全部门禁。

## 正式入口契约

- `renderBasecardView(ctx)`：Host 通用查看链路与编辑引擎单卡 iframe 复用；
- `renderBasecardEditor(ctx)`：Host 托管编辑器与编辑引擎本地编辑面板复用；
- `basecardDefinition`：编辑引擎运行时注册表消费，`pluginId/cardType/icon` 与 `manifest.yaml` 对齐，别名 `FileCard`，预览态 `previewPointerEvents: "shielded"`。
