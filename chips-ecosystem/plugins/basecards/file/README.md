# @chips/plugin-file（文件基础卡片）

`chips.basecard.file` / 卡片类型 `base.file`：在复合卡片中保存任意文件——文件名与后缀自动识别、按文件后缀解析 9 类别呈现内置默认封面、后缀未登记类别时回退后缀文字徽标占位；查看态整卡点击经平台资源打开链路（`resource:open`，《01-卡片文件格式》§6.9：不传业务载荷）交给资源处理器。

## 包结构

```
manifest.yaml                  插件清单：cardTypes=[base.file]、aliases=[FileCard]、resources:read
assets/icons/                  卡片类型图标（svg，随旧族 file-BCP 迁移，见 SOURCE.md）
assets/covers/                 9 类别默认封面素材（随旧族 file-BCP 迁移，见 SOURCE.md）
assets/schemas/                config 的 JSON Schema（2020-12 方言）
src/config.ts                  配置模型：readConfig / validateConfig / buildContent、
                               展示派生（文件名）、buildFileOpenRequest（14 §2.2、无业务载荷）
src/main.ts                    主进程入口：validateConfig / createInitialContent / collectResourcePaths
src/render.tsx                 渲染入口：renderView / renderEditor（IBaseCardPlugin 渲染面）
src/view.tsx                   查看态文件卡：封面三级回退（自定义封面 → 类别默认封面 → 后缀徽标占位）、
                               文件名与后缀、空态、整卡打开臂
src/editor.tsx                 编辑态面板：文件路径（必填）与自定义封面路径（可选）表单 +
                               文件名/后缀只读派生展示（01 §6.9：不提供手工编辑字段）
src/shared/file-types.ts       9 类别判定体系（后缀映射表 + MIME 内置映射表，自旧族逐字迁移）
src/shared/default-covers.ts   类别默认封面常量（素材经 Vite ?inline 进 render.js）
src/shared/utils.ts            包内相对路径归一、文件名/后缀/词干派生、后缀徽标、导入文件名清洗
tests/                         判定表逐项钉死 + config 纯函数 + 渲染面 jsdom（215 用例）
```

## 契约要点

- 卡片内容：`{ card_type: 'base.file', config: { file_file, file_name, file_extension, cover_image } }`
  （《01-卡片文件格式》§6.9；`FileCard` 历史别名由 manifest aliases 只读归一，不作新写入值；
  旧族 `theme` 字段随主题系统废弃，不迁）。
- `file_name` / `file_extension` 由编辑器在导入文件时自动识别，不提供手工编辑字段；字段缺失时
  从 `file_file` 派生（词干 / 小写后缀）。
- 双入口（08 §2.5）：`dist/index.js` 承载主进程纯函数；`render.js` 承载渲染方法，React/`@chips/ui`
  外部化为平台 vendor，9 张类别封面经 `?inline` 数据 URL 内联。
- 权限最小化：`resources:read`（`resource:open` 能力的权限映射，R19 全表）。
- 资源引用只接受包内相对路径引用（归一拒绝 `..`、反斜杠、绝对路径、带 scheme 引用与查询串、
  片段标识）；打开请求的 `uri` 一律透传内容中的引用，插件不构造作用域（《06-资源协议规范》§2.3）。
- `collectResourcePaths` 返回 `file_file` 与 `cover_image` 中全部有效卡片根目录相对路径并去重排序
  （01 §6.9 补充说明第 6 条）。

## 已登记缺位（工单062）

- 资源打开处理器族未实现：`chips.official.universal-file-viewer`（fallback）与专用查看器族均
  「已设计」（W5 重写波次），`resource:open` 路由后暂无处理器命中；打开失败以行内简体中文提示
  如实呈现，不伪造成功。
- 渲染帧插件执行通道（工单025 剩余 / #85）未交付：帧内打开臂正式通道 `frame:action` 待切换。
- 编辑器资源导入通道缺位：文件落卡片的导入编排（自动识别回填、封面选择、替换/删除时旧资源
  登记删除）待资源写入链路开放；导入清洗纯函数已随包交付待消费。

## 命令

```bash
npx -y pnpm@9 --filter @chips/plugin-file test        # 测试
npx -y pnpm@9 --filter @chips/plugin-file typecheck   # 类型
npx -y pnpm@9 --filter @chips/plugin-file lint        # lint
npx -y pnpm@9 --filter @chips/plugin-file build       # 构建 dist/index.js + render.js
```
