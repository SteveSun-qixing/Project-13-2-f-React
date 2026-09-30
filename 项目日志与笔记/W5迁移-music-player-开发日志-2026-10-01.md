# W5 迁移：音乐播放器（chips.official.music-player）第③段开发日志

> 日期：2026-10-01
> 任务：派单行表 #4——迁移 21 行（引擎/队列/元数据/歌词/封面解码），壳/UI 重写；氛围层与字体按矩阵废弃不再实现；端到端候 `resource:open` audio 槽位（工单060 关联面），embedded-artwork-cache 涉 mp G-2 候裁、media.tagparse 双解析源涉 mp G-3 候裁——只登记依赖不实现。
> 包：`chips-ecosystem/plugins/apps/music-player/`（分支「第五次重构」，全程零 git 写操作）
> 母型：`plugins/apps/video-player`（同批判例：命令族注册/降级登记形制）、`plugins/apps/book-reader`（basecards 公开导出消费判例）、骨架 `src/commands/appCommands.ts` 形制。

---

## 一、交付清单（矩阵行 × 落点）

| 矩阵行（音乐富文本社区客户端仓 §二） | 判定 | 落点 | 说明 |
|---|---|---|---|
| 播放状态机（audio-engine.ts:348） | 迁移 | `src/player/audioEngine.ts` | 逐行保真迁移；`<audio>` 事件面/缓冲/音量进度归一/单曲循环；`errorKey` 稳定标识保留，中文文案映射重写件化（`src/ui/messages.ts`，R5 去 key 层） |
| 元素绑定 hook（useMusicPlayerController.ts:129） | 迁移 | `src/player/useMusicPlayerController.ts` | `appConfig.defaultLoopMode` 常量随迁内联（矩阵口径）；旧 `handleKeyDown` 空实现不随迁（禁占位），键位由重写件 `usePlayerKeyboard` 承载真实键位语义 |
| 播放队列（playlist-engine.ts:121） | 迁移 | `src/player/playlistEngine.ts` | 纯数据结构与循环序逻辑；判例随迁（真实曲目夹具：真实地址 → `createAudioSourceFromUri` → 队列元素） |
| 嵌入元数据读取（audio-metadata.ts:1,144） | **迁移改道：消费已交付件** | `@chips/plugin-music` 公开导出 | 按本臂复用红线，元数据解析面统一消费 `plugins/basecards/music` 已交付的 `parseEmbeddedAudioMetadata`（workspace:* 依赖、经公开入口 import、禁第二份拷贝）；旧仓 1,144 行手写解析不复制（收口 mp G-3 双解析源张力） |
| 封面解码与呈现支撑（artwork-runtime.ts:202 + binary.ts:45） | 迁移 | `src/player/artworkRuntime.ts`、`src/player/binary.ts` | 逐行保真迁移；`EmbeddedArtwork` 类型改消费 `@chips/plugin-music` 公开导出；判例随迁（含 ImageDecoder 转码/canvas 桩/createImageBitmap 兜底/TIFF 不重复宿主转换） |
| 歌词解析与布局（lyrics.ts:224 + lyrics-layout.ts:43） | 迁移 | `src/player/lyrics.ts`、`src/player/lyricsLayout.ts` | 逐行保真迁移；判例随迁并加**真实夹具面**（`tests/fixtures/lyrics/sample-timed.lrc`/`sample-plain.txt` 真实文件字节 → `decodeTextWithFallback` → `parseLyricsText`，不 mock 解析器） |
| 格式表与纯函数域（music-player.ts:302 + layout.ts:36） | 迁移 | `src/player/musicPlayer.ts`、`src/player/layout.ts` | 唯一旧 SDK 触达点收口：`import type MusicCardOpenPayload`（chips-sdk）→ 本地 `IMusicCardOpenPayload`（14-契约 §5.4 载荷形状，vp `IVideoCardPlayback` 同口径）；判例随迁 |
| 播控/歌词/舞台 UI（Stage/TransportControls/LyricsPane/SeekBar/MobilePager + 8 CSS + messages.ts:101） | 重写 | `src/ui/`（AppView/PlayerStage/LyricsPane/TransportControls/QueueList/AssemblyForm/EmptyState/messages） | `@chips/ui` 唯一导入面（组件+图标全经白名单转发，零 `@ant-design/icons` 直装、零独立 CSS）；样式全 token（`theme.useToken`）；文案简体中文直写；交互语义保留：进度点选（Slider 拖动预览/松手提交）、歌词跟随（活动行定位+视口偏移+行内进度强调，消费迁移件布局纯函数）、窄竖长视口单列分档（消费迁移件 `shouldUseMobilePagerLayout`） |
| 打开投递与资源解析（launch-resource.ts:74） | 候端到端 | 本臂不实现 | `resource:open` audio 槽位候宿主资源打开路由（工单060 同源）；空态以直接可播放地址装配同一 `TrackPresentation` 会话形状，落波后零形状改动接入 |
| 嵌入封面伴生落盘（embedded-artwork-cache.ts:185） | 候裁只登记 | 本臂不实现 | mp G-2 候裁（TIFF→PNG 归一能力名未落档）；渲染侧 TIFF 维持「原字节直挂 blob URL」既有语义（迁移判例锁定），不重复宿主归一 |
| manifest / 应用壳 / 旧装配 | 重写 | 骨架既有 manifest（audio/* 关联）+ `src/index.ts` launch | 氛围层 8 行、专有字体 4 行按矩阵**废弃**不迁移；图标 assets 随骨架 |

### 重写件（壳层装配域）

- `src/player/trackSession.ts`：纯编排层——`createAudioSourceFromUri`（URI 展示名解码 vp 判例同口径；data: 地址展示名不用 base64 载荷）、`probeAudioMetadata`（可取字节地址经真实 `fetch` → `parseEmbeddedAudioMetadata`；`file:` 与传输失败如实返回 null，渲染会话无字节通道，工单061 在册）、`fetchCompanionLyrics`（真实字节 → `decodeTextWithFallback` → `parseLyricsText`）、`buildTrackPresentation`（展示/歌词/封面三级优先级裁决）。
- `src/player/queuePersistence.ts`：`MusicQueueStore` 接口 + 窗口会话内存态实现（工单066 在册引用，`config:*` 落波后换接 `IAppConfig`、消费面零改动）+ `normalizeQueueSnapshot` 快照守卫。
- `src/player/usePlayerQueue.ts`：队列 hook，迁移件引擎为唯一事实源，快照入存储、会话回读。
- `src/player/usePlayerKeyboard.ts`：窗口键位（空格/←→/↑↓/M/L/N/P，输入控件聚焦不抢占），键位帮助表与派发表同源。

## 二、命令注册面（与 manifest 逐字对应）

- `music-player:open-card` / `music-player:refresh-view`：manifest `cli.commands` 两入口保持；`appCommands.ts` 元数据与清单逐字对应（锁测：`commands.test` 的 MANIFEST_CLI_COMMANDS 对照）。
- 播放控制/队列命令族新增 9 条（toggle-playback / seek-forward / seek-backward / volume-up / volume-down / toggle-mute / toggle-loop / next-track / previous-track）：ui 目标、`handlerId` 配对（显式 kebab→camel 映射，vp 判例同形）、《13-命令系统契约》§2.1 文法、简体中文文案、播放控制/队列分组。**不进 manifest `cli.commands`**（CLI 消费入口语义不适用），**不声明 `shortcut`**：窗口内键位由 `usePlayerKeyboard` 承载，避免平台窗口级快捷键派发通道交付后双重绑定回潮。
- 动作表经 `resolveActions()` 现取（ref 引用，注册 effect 幂等装配一次）；动作缺位静默跳过（空态派发无效应），执行记录照常上报。`command:*` 宿主处理器缺位期间注册失败收敛为「命令通道异常」状态行，界面/键位照常工作（诚实降级，不假接线）。

## 三、复用红线打通与保真修复记录

1. **`@chips/plugin-music` 公开导出打通（复用红线前置件）**：basecards/music 的 `src/shared/audio-metadata.ts` 此前仅包内使用、无公开入口。按 book-reader 判例（`@chips/plugin-book`）三处收口：①`plugins/basecards/music/src/index.ts` 追加 `parseEmbeddedAudioMetadata` + `EmbeddedAudioMetadata`/`EmbeddedArtwork` 类型公开导出；②`tsconfig.base.json` paths 补 `@chips/plugin-music` 精确条目（工单003-B 锚定口径，杜绝回退旧根同名包）；③music-player 三份 vite/vitest 配置以 alias 终结于源码（构建期把 workspace 依赖内联为自包含产物）。music 的 basecard 渲染代码被 tree-shaking 隔离（render.js 73.10 kB，零 basecard 渲染代码混入；对照 book-reader 366 kB 判例同机制）。**music 包自身四闸复验全绿**（42 用例/typecheck/lint/build）。
2. **元数据探测走真实链**：测试面以 data: 地址经真实 `fetch`（undici）取真实 ID3v2.3 夹具字节（`tests/fixtures/metadata/sample-id3v2.mp3`，含 TIT2/TPE1/TALB/USLT/APIC 帧与真实 PNG 字节），全链不 mock 解析器；仅「传输失败」路径以传输层桩表达。夹具解析结果与 basecards 公开导出直读断言一致（单一解析源锁测）。
3. **保真修复（判迁移 ≠ 复刻缺陷）**：旧 playlist-engine 的 `syncIndexFromItem` 死函数不随迁（全路径零调用）；旧 music-player.ts 的 `resolveMediaErrorKey(MediaError)` 与引擎同名函数重复，收敛为引擎单份；旧 `TrackPresentation`/`ArtworkSourceKind` 由会话装配层以新形状收口（封面承载伴生地址/嵌入字节/默认三类来源——URI 未解析前 `artworkUri` 无法表达嵌入字节）。
4. **vp 判例随迁**：`decodeUriFileName`（URL.pathname 百分号编码 → 展示名原文字还原，非法编码原样保留）；`createAppCommandHandlers` 的 `handlerIdToActionKey` 显式映射。
5. **ants 转发面纪律**：组件与图标一律从 `@chips/ui` 导入（首版 `@ant-design/icons` 直装在测试环境会回退旧根 node_modules 命中第二 React 实例，已收口为白名单导入）；antd 6 弃用面零触达（`List`→令牌化自绘列、`Alert message`→`title`、`Spin tip`→`description`）。

## 四、诚实降级与工单引用

- **工单066**（在册引用，不重复开单）：`config:*` 域宿主处理器缺位，播放队列持久化降级为窗口会话内存态；`MusicQueueStore` 接口收口待换接。README「已登记缺位」节与本日志同步；工单066《任务说明》§七已追加本臂落波进展补记。
- 命令通道降级：同 §二（骨架既有口径，保持）。
- **mp G-2 / mp G-3 只登记不实现**：G-2（embedded-artwork-cache/伴生封面臂）候「TIFF→PNG 归一能力名落档」；G-3 已按本臂复用红线实质收口（应用内置解析不复制、统一消费 basecards 公开导出），正式裁决仍候主智能体销项。
- 零绕过声明：无 localStorage/sessionStorage 旁路、无占位实现、无 TODO；UI 空态/错误态/命令态/无歌词态全部如实呈现。

## 五、验证（亲跑，2026-10-01）

- `pnpm exec vitest run`：**16 文件 133 用例全绿**（随迁判例：playlist-engine/audio-engine/lyrics/lyrics-layout/music-player/layout/binary/artwork-runtime；重写件判例：track-session/queue-persistence/player-queue/player-keyboard/controller/commands/app-view/app）；
- `pnpm exec tsc -p tsconfig.json --noEmit`：零错误（`exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` 面收口）；
- `pnpm exec eslint src tests`：零错误零警告；
- `pnpm run build`：`dist/index.js` 0.22 kB + `render.js` 73.10 kB（vendor 外部化，红线守卫通过）；
- FORBIDDEN_ANTD_EXPORTS 机检（词界双验法）：A 面 antd/`@chips/antd` 导入零命中；B 面 28 名词界扫描唯一命中 `message`（22 处，全部为迁移件 `ViewerFeedback` 载荷字段与字面量属性，勘误四类误报源之「载荷字段」）与 `version`（2 处，`IMusicCardOpenPayload.version` 载荷字段），零静态实例通道、零禁面组件触达；
- 被改动的关联包复验：`plugins/basecards/music` 四闸全绿（42 用例/typecheck/lint/build，render.js 68.19 kB）；
- 未跑 `gates:all`（按派单约束）；安装持目录锁 `/tmp/w4-lockguard`。

## 六、边界与后续（候裁/候波次，不代裁）

1. `resource:open` audio 槽位端到端（启动投递 → `TrackPresentation` 会话装配）候宿主资源打开路由（工单060~064 同源）；落波后 `AppView` 增投递消费臂，会话形状零改动复用；`file:` 地址的元数据字节通道随资源句柄读取翻正（工单061 关联面）。
2. config 域处理器落波后队列持久化翻正（工单066 期望面，`MusicQueueStore` 换接实现即可）。
3. `command:*` 宿主派发通道交付后：播放控制命令按需迁移 `shortcut` 绑定（§二）。
4. mp G-2 落档后：嵌入封面伴生落盘臂（embedded-artwork-cache 重写）随批派单，`resolveEmbeddedArtworkUrl`/`convertEmbeddedArtworkToPngBytes` 已就绪可直接消费。
5. 《09-官方插件与应用目录》§7.2 music-player 行状态翻正候端到端臂收口时随批办理（工单060 判例：应用行翻正与端到端就绪同步，本臂不代改）。
6. 渲染帧插件执行通道（#85/工单025）不影响本应用（app 表面为窗口级，非帧内渲染）。
