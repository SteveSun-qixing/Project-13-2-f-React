# @chips/plugin-music（音乐基础卡片）

`chips.basecard.music` / 卡片类型 `base.music`：在复合卡片中呈现音频内容节点——封面、歌曲信息与制作团队；查看态经平台资源打开链路（`resource:open`，载荷 `chips.music-card` v1.0.0，《14-资源打开与默认处理器契约》§9.2）交给音乐播放器。

## 包结构

```
manifest.yaml                  插件清单：cardTypes=[base.music]、aliases=[MusicCard]、resources:read
assets/icons/                  卡片类型图标（svg）
assets/placeholders/           默认占位封面素材（随旧族 music-BCP 迁移，见 SOURCE.md）
assets/schemas/                config 的 JSON Schema（2020-12 方言）
src/config.ts                  配置模型：readConfig / validateConfig / buildContent、
                               展示派生（标题/歌手）、buildMusicOpenRequest（14 §9.2）
src/main.ts                    主进程入口：validateConfig / createInitialContent / collectResourcePaths
src/render.tsx                 渲染入口：renderView / renderEditor（IBaseCardPlugin 渲染面）
src/view.tsx                   查看态播放卡：封面（默认占位兜底）/标题/歌手/元信息/空态/打开臂
src/editor.tsx                 编辑态面板：资源路径、歌曲信息与制作团队表单
src/shared/audio-metadata.ts   ID3v2 / MP4 / FLAC 内嵌元数据纯解析（自旧族逐字迁移，零 Host 依赖）
src/shared/default-cover.ts    默认封面常量（素材经 Vite ?inline 进 render.js）
src/shared/utils.ts            包内相对路径归一、文件名与音频 MIME 推断
tests/                         元数据真实字节夹具测试 + config 纯函数 + 渲染面 jsdom
```

## 契约要点

- 卡片内容：`{ card_type: 'base.music', config: { audio_file, music_name, album_cover, lyrics_file, production_team, release_date, album_name, language, genre } }`（《01-卡片文件格式》§6.8；`MusicCard` 历史别名由 manifest aliases 只读归一，不作新写入值）。
- 双入口（08 §2.5）：`dist/index.js` 承载主进程纯函数；`render.js` 承载渲染方法，React/`@chips/ui` 外部化为平台 vendor。
- 权限最小化：`resources:read`（`resource:open` 能力的权限映射，R19 全表）。
- 资源引用只接受包内相对路径引用（归一拒绝 `..`、反斜杠、绝对路径与带 scheme 引用）；打开请求的 `uri` 一律透传内容中的引用，插件不构造作用域（《06-资源协议规范》§2.3）。

## 已登记缺位（工单060）

- `chips.official.music-player`（audio/* primary 处理器）未实现（W5 重写波次），`resource:open` 路由后暂无命中；打开失败以行内简体中文提示如实呈现，不伪造成功。
- 渲染帧插件执行通道（工单025 剩余 / #85）未交付：帧内打开臂正式通道 `frame:action` 待切换。
- 编辑器资源导入通道缺位：音频文件落卡片的导入编排（含嵌入元数据自动补全接线）待资源写入链路开放；解析器已随包交付。

## 命令

```bash
npx -y pnpm@9 --filter @chips/plugin-music test        # 测试
npx -y pnpm@9 --filter @chips/plugin-music typecheck   # 类型
npx -y pnpm@9 --filter @chips/plugin-music lint        # lint
npx -y pnpm@9 --filter @chips/plugin-music build       # 构建 dist/index.js + render.js
```
