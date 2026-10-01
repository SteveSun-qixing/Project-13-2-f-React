# @chips/plugin-video（视频基础卡片）

`chips.basecard.video` / 卡片类型 `base.video`：在复合卡片中呈现视频内容节点——封面、标题、外挂字幕轨与播放参数；查看态经平台资源打开链路（`resource:open`，载荷 `chips.video-card` v1.0.0，《14-资源打开与默认处理器契约》§5.4）交给视频播放器。

## 包结构

```
manifest.yaml                  插件清单：cardTypes=[base.video]、aliases=[VideoCard]、resources:read
assets/icons/                  卡片类型图标（svg，Material Symbols play_circle，见 SOURCE.md）
assets/schemas/                config 的 JSON Schema（2020-12 方言，口径对齐《01-卡片文件格式》§6.2）
src/config.ts                  配置模型：readConfig / validateConfig / buildContent、
                               展示派生（标题/元信息行）、buildVideoOpenRequest（14 §5.4）
src/main.ts                    主进程入口：validateConfig / createInitialContent / collectResourcePaths
src/render.tsx                 渲染入口：renderView / renderEditor（IBaseCardPlugin 渲染面）
src/view.tsx                   查看态播放卡：封面（首帧回退兜底）/播放信息徽标/标题/元信息/空态/打开臂
src/editor.tsx                 编辑态面板：资源路径、字幕轨列表、视频信息与播放参数
                               （InputNumber 默认倍速 0.25~4、起始秒数非负；Switch 自动播放/循环/静音）
src/shared/utils.ts            包内相对路径归一、文件名与视频/字幕 MIME 推断（旧仓 video-player 六项口径）
tests/                         config 纯函数 + 渲染面 jsdom（真实 BaseCardView 夹具 + 面板原生 setter 写值）
```

## 契约要点

- 卡片内容：`{ card_type: 'base.video', config: { video_file, cover_image, subtitles, playback, video_title, publish_time, creator } }`（《01-卡片文件格式》§6.2；`VideoCard` 历史别名由 manifest aliases 只读归一，不作新写入值）。
- 字幕轨：`id` / `file_path` 必填（§6.2），`kind` ∈ `subtitles | captions`，同一卡片最多一个 `default` 轨（插件归一取首个）。
- 播放参数：`playback.playback_rate` 域 [0.25, 4]、`start_time` 非负（§6.2 数值域，validateConfig 显式补充校验）；载荷中以 `playbackRate` / `startTime` 投递。
- 双入口（08 §2.5）：`dist/index.js` 承载主进程纯函数；`render.js` 承载渲染方法，React/`@chips/ui` 外部化为平台 vendor。
- 权限最小化：`resources:read`（`resource:open` 能力的权限映射，R19 全表）。
- 资源引用只接受包内相对路径引用（归一拒绝 `..`、反斜杠、绝对路径与带 scheme 引用）；打开请求的 `uri` 一律透传内容中的引用，插件不构造作用域（《06-资源协议规范》§2.3）。

## 已登记缺位（工单071，工单060 族）

- `chips.official.video-player`（`video/*` primary 处理器，《09-官方插件与应用目录》§5.2 状态「已设计」）未实现（W5 重写波次），`resource:open` 路由后 video 槽位暂无候选；打开失败以行内简体中文提示如实呈现，不伪造成功。
- 渲染帧插件执行通道（工单025 剩余 / #85）未交付：帧内打开臂正式通道 `frame:action` 待切换。
- 编辑器资源导入通道缺位（同工单060 第 3 条、工单062/063 同源）：视频/封面/字幕文件落卡片的导入编排与首帧缩略图自动生成（旧族 `extractVideoThumbnail` 注入面）待资源写入链路开放；面板行内如实说明，不伪造导入入口。

## 命令

```bash
npx -y pnpm@9 --filter @chips/plugin-video test        # 测试
npx -y pnpm@9 --filter @chips/plugin-video typecheck   # 类型
npx -y pnpm@9 --filter @chips/plugin-video lint        # lint
npx -y pnpm@9 --filter @chips/plugin-video build       # 构建 dist/index.js + render.js
```
