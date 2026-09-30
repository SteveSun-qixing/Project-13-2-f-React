# 音乐播放器

> 角色：`app`；插件 ID：`chips.official.music-player`；版本：`0.1.0`

音频播放、播放控制、队列、封面与歌词呈现。W5 应用迁移三段式第③段交付：迁移件（播放状态机/播放队列/LRC 歌词解析与布局/封面解码编排/格式表与纯函数域/二进制归一）＋重写件（窗口壳/播控/歌词舞台/队列面板/会话装配/命令族）。

## 功能与交付边界

- **播放状态机**（迁移件 `src/player/audioEngine.ts`）：`<audio>` 事件面、缓冲、音量/进度归一、单曲循环；`errorKey` 为稳定内部标识，界面文案映射见 `src/ui/messages.ts`（简体中文直写）。
- **播放队列**（迁移件 `src/player/playlistEngine.ts` + 重写 hook `src/player/usePlayerQueue.ts`）：引擎为唯一事实源，快照经 `src/player/queuePersistence.ts` 收口。
- **LRC 歌词**（迁移件 `src/player/lyrics.ts`/`lyricsLayout.ts`）：时间轴/元信息/纯文本降级解析、活动行定位与行内进度、滚动布局与交错时序；界面消费见 `src/ui/LyricsPane.tsx`。
- **封面解码编排**（迁移件 `src/player/artworkRuntime.ts`）：ImageDecoder/createImageBitmap/canvas 转码与 blob URL；嵌入封面类型消费 `@chips/plugin-music` 公开导出（复用红线，禁第二份拷贝）。
- **嵌入元数据**：统一消费 `@chips/plugin-music` 的 `parseEmbeddedAudioMetadata`（收口 mp G-3 双解析源张力）；本包不再持有标签解析实现。
- **命令族**：`open-card` / `refresh-view` 与 manifest `cli.commands` 逐字对应；播放控制/队列 9 条 ui 目标命令（toggle-playback、seek-forward/backward、volume-up/down、toggle-mute、toggle-loop、next-track、previous-track）经 `command:register` 登记，不进 manifest、不声明 `shortcut`（《13-命令系统契约》§2.3；窗口键位由 `usePlayerKeyboard` 承载）。
- **测试夹具**：`tests/fixtures/` 持真实 LRC/纯文本歌词与真实 ID3v2.3 音频文件；元数据探测与歌词拉取经真实 `fetch`（data: 地址）走完整解析链，不 mock 解析器。

## 已登记缺位（诚实降级面）

| 缺位 | 现状 | 落波后 |
|---|---|---|
| 队列持久化 | 窗口会话内存态（`MusicQueueStore` 接口收口，工单066 在册：`config:*` 域宿主处理器缺位） | 换接 `IAppConfig` 读写实现，接口不变、消费面零改动 |
| `resource:open` audio 槽位投递 | 启动投递/打开臂未接（工单060 同源）；空态以直接可播放地址装配会话（`file:`/`http(s)`/`blob:`/`data:`），`file:` 字节通道如实不可用 | 复用同一 `TrackPresentation` 会话形状接入投递臂 |
| 嵌入封面伴生落盘 | 未实现（mp G-2 候裁：TIFF→PNG 归一能力名未落档，只登记依赖）；渲染侧 TIFF 维持原字节直挂 blob URL 的既有语义 | 能力名落档后随伴生封面臂换接 |
| `command:*` 宿主派发 | 注册失败收敛为「命令通道异常」状态行，界面与键位照常工作 | 派发通道落波后命令面板/宿主快捷键可用 |

## 目录结构

```text
music-player/
├── manifest.yaml               # 唯一权威清单（audio/* 文件关联、cli.commands 两入口）
├── package.json                # @chips/plugin-music-player；依赖 @chips/plugin-music（workspace:*）
├── vite.main.config.ts         # 主进程入口构建 → dist/index.js（@chips/plugin-music 内联）
├── vite.render.config.ts       # 渲染入口构建 → render.js（React/@chips/ui 外部化为平台 vendor）
├── vitest.config.ts            # jsdom 环境 + 真实夹具
├── src/index.ts                # IAppPlugin 实现 → dist/index.js
├── src/commands/               # 命令元数据（11 条）与 UI 命令运行时接线
├── src/player/                 # 迁移件（audioEngine/playlistEngine/lyrics/lyricsLayout/artworkRuntime/binary/layout/musicPlayer）+ 重写件（trackSession/queuePersistence/usePlayerQueue/usePlayerKeyboard/useMusicPlayerController）
├── src/ui/                     # 窗口壳（AppView/PlayerStage/LyricsPane/TransportControls/QueueList/AssemblyForm/EmptyState/messages）
├── tests/                      # 16 文件 133 用例（随迁判例 + 重写判例 + 真实夹具面）
└── assets/icons/               # 启动器图标
```

## 常用命令

```bash
npx -y pnpm@9 install                                   # 在工作区根建立链接
npx -y pnpm@9 --filter @chips/plugin-music-player run typecheck
npx -y pnpm@9 --filter @chips/plugin-music-player run test
npx -y pnpm@9 --filter @chips/plugin-music-player run test:coverage
npx -y pnpm@9 --filter @chips/plugin-music-player run build
npx -y pnpm@9 --filter @chips/plugin-music-player run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《13-命令系统契约》《14-资源打开与默认处理器契约》§5.4；《TypeScript 编码规范》《测试规范》；迁移裁决底册见《旧功能覆盖矩阵-音乐富文本社区客户端》§二。
