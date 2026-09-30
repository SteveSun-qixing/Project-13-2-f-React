# @chips/plugin-book（电子书基础卡片）

`chips.basecard.book` / 卡片类型 `base.book`：在复合卡片中呈现电子书内容节点——封面、书籍信息与解包图片序列；查看态经平台资源打开链路（`resource:open`，载荷 `chips.book-card` v1.0.0，《14-资源打开与默认处理器契约》§5.4）整卡交付书籍阅读器或图片查看器。

## 包结构

```
manifest.yaml                       插件清单：cardTypes=[base.book]、aliases=[BookCard]、resources:read
assets/icons/                       卡片类型图标（svg，自旧族随迁）
assets/schemas/                     config 的 JSON Schema（2020-12 方言）
src/config.ts                       配置模型：readConfig / validateConfig / buildContent、
                                    展示派生（标题/作者/格式标签）、buildBookOpenRequest（14 §5.4）
src/main.ts                         主进程入口：validateConfig / createInitialContent / collectResourcePaths
src/render.tsx                      渲染入口：renderView / renderEditor（IBaseCardPlugin 渲染面）
src/view.tsx                        查看态阅读卡：封面（占位/兜底图形）/标题/作者/格式与图片数元信息/空态/打开臂
src/editor.tsx                      编辑态面板：来源形态、书籍文件与格式、图片序列条目、封面与书籍信息表单
src/shared/archive.ts               ZIP 纯解析（中央目录 / store / deflate-raw / ZIP64 / CP437，自旧族逐字迁移）
src/shared/epub.ts                  EPUB 元数据纯解析（container→OPF→封面三臂，自旧族逐字迁移）
src/shared/use-resolved-resources.ts 资源解析 Hook（归一去重 / 重试 / 释放时序，自旧族逐字迁移）
src/shared/utils.ts                 路径归一收紧口径、书籍与图片 MIME 推断、文件名清洗与序列排序
tests/                              ZIP/EPUB 真实字节夹具测试 + Hook 时序 + config 纯函数 + 渲染面 jsdom
```

## 契约要点

- 卡片内容：`{ card_type: 'base.book', config: { source_type, book_file, book_format, book_name, book_author, cover_image, image_sequence, image_sort_basis } }`（《01-卡片文件格式》§6.10：插件定义类型，schema 随包发布；`BookCard` 历史别名由 manifest aliases 只读归一，不作新写入值）。相对旧族的字段级重构：`theme` 随主题系统废弃（task030）裁撤；`resource_paths` 由 `collectResourcePaths` 派生、不再持久化；`sort_key` 为旧仓只写不读的死字段，裁撤。
- 双入口（08 §2.5）：`dist/index.js` 承载主进程纯函数；`render.js` 承载渲染方法，React/`@chips/ui` 外部化为平台 vendor。
- 权限最小化：`resources:read`（`resource:open` 能力的权限映射，R19 全表）。
- 资源引用只接受包内相对路径引用（归一拒绝 `..`、反斜杠、绝对路径与带 scheme 引用，《06-资源协议规范》§2.4）；打开请求的 `uri` 一律透传内容中的引用，插件不构造作用域（06 §2.3）。
- 打开载荷（14 §5.4）：`mode: 'ebook'` 主资源为 `book_file`；`mode: 'image-sequence'` 主资源必须是排序后序列首项，`resources.images[]` 全组按序随载荷；排序依据 `entry-time`（有可分辨条目时间时）优先，否则文件名自然序。
- 阅读进度 / 目录 / 书签是书籍阅读器应用内引擎状态（《10-官方内容处理与阅读服务设计》§2.1），不在卡片内实现。

## 已登记缺位（工单064）

- `chips.official.book-reader`（epub/pdf/txt 等电子书槽位 primary 处理器）未实现（W5 重写波次），`resource:open` 路由后暂无命中；打开失败以行内简体中文提示如实呈现，不伪造成功。
- 渲染帧插件执行通道（工单025 剩余 / #85）未交付：帧内打开臂正式通道 `frame:action` 待切换。
- 编辑器资源导入通道缺位：EPUB / 图片包文件落卡片的导入编排（EPUB 元数据自动补全、压缩包解包、封面回填）待资源写入链路开放；`epub.ts` / `archive.ts` / `use-resolved-resources.ts` 已随包交付并测毕，通道就绪后接线。

## 命令

```bash
npx -y pnpm@9 --filter @chips/plugin-book test        # 测试
npx -y pnpm@9 --filter @chips/plugin-book typecheck   # 类型
npx -y pnpm@9 --filter @chips/plugin-book lint        # lint
npx -y pnpm@9 --filter @chips/plugin-book build       # 构建 dist/index.js + render.js
```
