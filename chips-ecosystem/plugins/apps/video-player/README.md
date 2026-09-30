# 视频播放器

> 角色：`app`；插件 ID：`chips.official.video-player`；版本：`0.1.0`

视频播放：控制、倍速、全屏、画中画、字幕与音轨（《09-官方插件与应用目录》§7.2）。

W5 第③段迁移交付（母仓 `Chips-VideoPlayer`，覆盖矩阵《旧功能覆盖矩阵-四媒体查看器仓》§五）：
播放 hook 族与格式支持表按裁决迁移（纯逻辑 + 测试随迁），控制 UI、壳装配层与偏好持久化按裁决重写。

## 功能面

- **播放状态机**：`<video>` 事件驱动（就绪/缓冲/错误归一键/结束/进度节流刷新），零 SDK 触达；
- **轨道**：字幕轨（`subtitles`/`captions`）与音轨（可选 `audioTracks` 面）读取与切换；
- **画面**：全屏（Fullscreen API）与画中画（PiP，能力探测降级禁用）；
- **键位**：空格/K 播放暂停、←→ 跳转（Shift ±30 秒）、J/L ±10 秒、↑↓ 音量、M 静音、F 全屏、
  P 画中画、0-9 百分比跳转、[ ] 逐帧、? 键位帮助（《03-查看器设计》§10.1 媒体键位行）；
- **控制层**：进度拖动（拖动预览、松手提交）+ 缓冲条、音量、倍速（0.5x~2x 白名单）、循环、
  更多面板（视频信息/字幕/音轨）、控制层自动隐藏（播放中 2.2s 收起，浮层/面板占用电停）；
- **格式支持表**：`.mp4` `.webm` `.mov` `.m4v` `.ogv`（MIME 推断、格式标签、可直播 URI 判定
  `file:/http:/https:/blob:/data:`）。

## 命令

`open-card` / `refresh-view` 为 CLI 消费入口（manifest `cli.commands`，运行时命令元数据逐字对应）；
播放控制命令族（播放或暂停、前进/后退 5 秒、静音、切换倍速、循环播放、切换全屏/画中画）为
ui 目标命令，由渲染会话经 `command:register` 登记进平台命令注册表（《13-命令系统契约》§2.3），
供命令面板等入口统一消费；窗口内键位由播放器键盘 hook 承载，命令记录不重复声明 `shortcut`。

`command:*` 能力的宿主侧处理器未落波期间，注册失败收敛为「命令通道异常」状态行如实呈现，
界面与键位交互照常工作。

## 已登记缺位（工单066）

偏好持久化（音量/静音/倍速/循环/字幕）权威链路为 `config:*` 自身命名空间（`IAppConfig`）；
配置域宿主处理器缺位期间**诚实降级为窗口会话内存态**：同一窗口会话内读写一致、关窗即失。
存储以 `VideoPlayerPreferenceStore` 接口收口，宿主 `config:*` 落波后换接实现、消费面零改动。
详见 `项目日志与笔记/工单066-配置域宿主处理器缺位致应用偏好持久化降级内存态/`。

`resource:open` video 槽位端到端（启动投递 → 会话装配）随宿主资源打开路由落波接入；
当前会话装配入口为空态地址输入（`file:` / `http(s):` / `blob:` / `data:` 直播地址）。

## 目录结构

```text
video-player/
├── manifest.yaml                 # 唯一权威清单（video/* primary 槽位 + cli.commands）
├── package.json                  # 工作区包 @chips/plugin-video-player
├── vite.shared.ts                # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts           # 主进程入口构建 → dist/index.js
├── vite.render.config.ts         # 渲染入口构建 → render.js
├── vitest.config.ts              # jsdom 测试配置（单元测试与包级集成测试）
├── src/
│   ├── index.ts                  # IAppPlugin 实现 → dist/index.js
│   ├── player/                   # 播放域（迁移件 + 重写件）
│   │   ├── videoPlayer.ts        # 格式表/播放参数/纯函数（迁移，测试随迁）
│   │   ├── preferences.ts        # 偏好存储（重写：config:* 降级内存态，工单066）
│   │   ├── usePlaybackEngine.ts  # 播放状态机（迁移）
│   │   ├── useTracks.ts          # 字幕/音轨（迁移）
│   │   ├── useFullscreen.ts      # 全屏/画中画（迁移）
│   │   ├── usePlayerKeyboard.ts  # 键位（迁移）
│   │   ├── useChromeVisibility.ts# 控制层自动隐藏（迁移）
│   │   └── useVideoPlayerController.ts # 壳装配层（重写）
│   ├── commands/                 # 命令元数据 + UI 命令运行时接线
│   ├── ui/                       # 应用窗口界面（重写：@chips/ui + antd 白名单 + token 样式）
│   └── messages.ts               # 简体中文文案层（媒体错误键映射 + 键位帮助表）
├── tests/                        # vitest 单元测试（迁移判例随迁 + 重写件测试）
└── assets/icons/                 # 启动器图标
```

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-video-player run typecheck
pnpm --filter @chips/plugin-video-player run test
pnpm --filter @chips/plugin-video-player run test:coverage
pnpm --filter @chips/plugin-video-player run lint
pnpm --filter @chips/plugin-video-player run build
pnpm --filter @chips/plugin-video-player run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 规范入口

《应用插件开发指南》《应用插件接口》；《13-命令系统契约》；《10-官方内容处理与阅读服务设计》§3；
《03-查看器设计》§8.2/§10；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。
