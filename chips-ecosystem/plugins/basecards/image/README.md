# @chips/plugin-image（图片基础卡片）

`chips.basecard.image` / 卡片类型 `base.image`：在复合卡片中呈现图片内容节点——包内文件与远程地址两种来源，单图、网格、纵向长图与横向滚动四种排版；查看态点击图片经平台资源打开链路（`resource:open`）交给图片查看器。

## 包结构

```
manifest.yaml                  插件清单：cardTypes=[base.image]、aliases=[ImageCard]、resources:read
assets/icons/                  卡片类型图标（svg，自旧族 image-BCP 随迁）
assets/schemas/                config 的 JSON Schema（2020-12 方言）
src/config.ts                  配置模型：readConfig / validateConfig / buildContent、
                               有效布局派生、智能默认、buildImageOpenRequest（14 §2.2 输入模型）
src/main.ts                    主进程入口：validateConfig / createInitialContent / collectResourcePaths
src/render.tsx                 渲染入口：renderView / renderEditor（IBaseCardPlugin 渲染面）
src/view.tsx                   查看态：空态 / 单图 / 网格（溢出角标）/ 纵向长图 / 横向滚动、
                               加载失败占位、打开臂
src/editor.tsx                 编辑态面板：图片列表（拖拽排序 + 删除托盘）、选中图片信息、
                               链接添加与替换、排版设置
src/shared/utils.ts            包内相对路径归一、MIME 推断、拖拽落点纯函数
tests/                         config 纯函数 + 渲染面 jsdom 真实断言
```

## 契约要点

- 卡片内容：`{ card_type: 'base.image', config: { images, layout_type, layout_options } }`
  （《01-卡片文件格式》§6.3；`ImageCard` 历史别名由 manifest aliases 只读归一，不作新写入值）。
- 归一规则（《01》§6.3 补充说明）：多于一张图且传入 `single` 归一改写 `grid`；至多一张图运行时
  有效布局强制 `single`；`url` 仅接受 `http(s)` / `webdav`，`data:` 禁止持久化（validateConfig 拒绝）。
- 双入口（08 §2.5）：`dist/index.js` 承载主进程纯函数；`render.js` 承载渲染方法，React/`@chips/ui`
  外部化为平台 vendor。
- 权限最小化：`resources:read`（`resource:open` 能力的权限映射，R19 全表）；渲染帧内图片经
  `<base href>` 协议路径直接加载，不申请权限。
- 资源引用：`file_path` 只接受包内相对路径（归一拒绝 `..`、反斜杠、绝对路径与带 scheme 引用）；
  打开请求的 `uri` 一律透传内容中的引用，插件不构造作用域（《06-资源协议规范》§2.3）；
  图片类型未在《14》登记业务载荷，不构造 payload。

## 已登记缺位（工单063）

- `chips.official.photo-viewer`（image/png、image/jpeg、image/webp、image/gif、image/bmp、
  image/svg+xml、image/avif primary 处理器）未实现（W5 重写波次），`resource:open` 路由后图片
  槽位暂无命中；打开失败以行内简体中文提示如实呈现，不伪造成功。
- 渲染帧插件执行通道（工单025 剩余 / #85）未交付：帧内打开臂正式通道 `frame:action` 待切换。
- 编辑器资源导入通道缺位（同工单060 第 3 条）：本地图片文件落卡片（选择/拖放 → 资源写入 →
  路径回填）与 TIFF→PNG 转换（内容处理服务族）未开放给基础卡片编辑器；编辑器先行承接链接添加
  与既有配置编辑，面板内行内提示如实说明。

## 命令

```bash
npx -y pnpm@9 --filter @chips/plugin-image test        # 测试
npx -y pnpm@9 --filter @chips/plugin-image typecheck   # 类型
npx -y pnpm@9 --filter @chips/plugin-image lint        # lint
npx -y pnpm@9 --filter @chips/plugin-image build       # 构建 dist/index.js + render.js
```
