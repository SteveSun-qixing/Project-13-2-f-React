# Host 安装器与内置插件发布链路

## 1. 目标

本文档记录当前 Host 在 macOS 安装分发、内置插件引导、首启窗口与文件关联注册方面的正式实现。

## 2. 实现位置

- 内置插件引导：
  - `src/main/core/built-in-plugins.ts`
  - `src/main/core/host-application.ts`
- 启动输入与文件关联分发：
  - `src/main/electron/app-entry.ts`
  - `src/main/core/file-association.ts`
- macOS 安装器：
  - `src/main/installer/macos-installer.ts`
  - `src/main/installer/cli.ts`

## 3. 当前内置插件集合

### 3.1 动态自动发现

内置插件集合由安装器与 Host 两侧共同采用「动态自动发现」机制，不再维护静态硬编码清单：

- **安装器侧**（`macos-installer.ts` 的 `discoverDefaultBuiltInPluginBundles`）：
  - 扫描工作区根目录下所有带 `manifest.yaml` 且类型为 `app/card/layout/module` 的官方插件工程；
  - 一级聚合目录 `Chips-BaseCardPlugin/*`、`Chips-BoxLayoutPlugin/*`、`Chips-ModulePlugin/*` 的子目录同样纳入发现；
  - 非插件工程（`Chips-Host`、`Chips-SDK`、`Chips-Scaffold`、`Chips-Ui`、`Chips-CommunityPlatformServer`、`Chips-PersonalServer`、`Chip-iconMaker`）被显式排除；
  - 每个插件按工程实际存在性收集 `manifest.yaml + dist`，以及存在的 `assets`、`contracts` 目录。
- **Host 侧**（`built-in-plugins.ts` 的 `discoverBuiltInPluginDefinitions`）：
  - Host 启动时扫描 `builtin-plugins` 根目录下所有子目录的 manifest（`manifest.yaml`/`manifest.yml`/`manifest.json`）；
  - 自动安装并启用全部发现到的内置插件；
  - 设置面板（`com.chips.eco-settings-panel`）保留快捷方式治理与首启拉起特殊标记。

安装器打包什么，Host 就引导什么，两侧天然对齐，未来新增官方插件无需修改 Host 或安装器代码。

### 3.2 当前预发布内置插件全集（34 个）

截至 2026-08-12，预发布安装器默认内置以下 34 个官方插件：

- app（9）：`com.chips.eco-settings-panel`、`com.chips.photo-viewer`、`com.chips.book-reader`、`com.chips.card-viewer`、`com.chips.community-client`、`com.chips.music-player`、`com.chips.rich-text-editor`、`com.chips.video-player`、`chips-official.editing-engine`
- card（8）：`chips.basecard.book/hyperlink/image/music/richtext/score/video/webpage`
- layout（10）：`chips.layout.cardstack/coverflow/documentlibrary/grid/infinitecanvas/list/map/masonry/scattered/timeline`（`.blp` 后缀省略）
- module（7）：`chips.module.chips.cardtohtml/colorpicker/community-uploader/cover/fileconversion/htmltoimage/htmltopdf`（`.plugin` 后缀省略）

主题插件已随 task030 卸担废弃，不再内置。

### 3.3 必选与可选

动态发现模式下，被发现的插件全部按必选处理：只要工程存在且构建产物可用即纳入打包；不存在于工作区的插件工程自然不会被发现，也不会阻塞安装器构建。

## 4. 内置插件引导链路

`HostCore.start()` 在 `runtime.load()` 后会执行内置插件引导：

1. 从 `process.resourcesPath/builtin-plugins`（或 `CHIPS_BUILTIN_PLUGINS_DIR`）解析内置插件根目录；
2. 自动扫描根目录下所有插件 manifest，动态生成内置插件定义；
3. 对发现的插件调用 `PluginRuntime.install(...)`；
4. 对全部插件执行 `runtime.enable(...)`；
5. 对设置面板补齐快捷方式治理；
6. 若设置面板是本轮首次安装，则记录首启拉起意图。

内置插件缺失 bundle 时只跳过该插件，不会阻塞 Host 首启（未发现的插件根本不会进入引导清单）。

## 5. 启动输入与文件关联分发

### 5.1 Electron 主入口

`src/main/electron/app-entry.ts` 当前会接收：

1. `--chips-launch-plugin=...`
2. 进程参数中的任意带扩展名文件路径
3. macOS `open-file`
4. `second-instance` 转发的文件路径

### 5.2 文件关联分发规则

`src/main/core/file-association.ts` 当前规则如下：

1. `.card`
   - 走 `card.open`
2. `.box`
   - 走 `box.inspect`
   - 再按 `file-handler:.box` 查找并拉起 app 插件
3. 其它扩展名
   - 查询 `plugin.query({ type: "app", capability: "file-handler:<ext>" })`
   - 命中后调用 `plugin.launch(...)`
   - 未命中时回退 `platform.shellOpenPath`

因此，普通文件类型的正式消费方已经由“硬编码扩展名白名单”变成“app 插件 capability 驱动”。

## 6. macOS 安装器行为

### 6.1 构建流程

`npm run build:installer:macos` 会：

1. 自动发现工作区中全部官方插件工程（app/card/layout/module）；
2. 构建存在的内置插件工程；
3. 构建 Host；
4. 组装 `Chips.app`（内置全部发现的官方插件）；
5. 生成 `.pkg` 安装包。

安装器 CLI（`src/main/installer/cli.ts`）支持：

- `macos`：构建 macOS 安装器（默认命令）；
- `--output=<dir>`：自定义产物输出目录；
- `--skip-prerequisites`：跳过前置构建（插件与 Host 构建），使用现有产物；
- `--list-plugins`：仅列出将被内置的官方插件工程清单，不执行构建。

构建过程中会对安装器产物做元数据净化：

1. 复制 Electron 模板和内置插件后，移除 `_CodeSignature`、`CodeResources`、`.DS_Store`、`._*` 等复制元数据；
2. component pkg 生成后展开 `Payload`，移除 payload 内的 `._*`、`.DS_Store`、`CodeResources`，并重新生成 gzip payload 与 BOM；
3. component pkg 和最终 product archive flatten 前会递归清理展开包目录，避免 `Scripts/._postinstall` 等非 payload 元数据残留。

内置插件采用动态发现，处理规则是：

1. 扫描工作区根目录及 `Chips-BaseCardPlugin/*`、`Chips-BoxLayoutPlugin/*`、`Chips-ModulePlugin/*` 下的带 `manifest.yaml` 工程；
2. 仅纳入类型为 `app/card/layout/module` 的插件；
3. 工程不存在或构建产物不可用的插件不会进入内置集合（动态发现天然容错）；
4. 若显式传入 `builtInPluginBundles`，则按显式清单处理，不再自动发现。

### 6.2 文件关联元数据生成

`prepareMacHostAppBundle()` 会扫描内置 app 插件 manifest 中的 `file-handler:<ext>` 能力，并把这些扩展名转换成 `Info.plist` 里的文档类型。

当前固定保留：

1. `.card`

当前按能力条件追加（来自随包内置 app 插件）：

1. `.box`（卡片查看器 `com.chips.card-viewer`）
2. `.png` `.jpg` `.jpeg` `.webp` `.gif` `.bmp` `.svg` `.avif`（图片查看器 `com.chips.photo-viewer`）
3. `.epub` `.pdf` `.txt` `.md` `.markdown` `.fb2` `.rtf` `.mobi` `.azw` `.azw3` `.djvu` `.doc` `.docx` 等（书籍阅读器 `com.chips.book-reader`）
4. `.mp3` `.flac` `.wav` `.ogg` 等（音乐播放器 `com.chips.music-player`）
5. `.mp4` `.mov` `.m4v` `.ogv` 等（视频播放器 `com.chips.video-player`）

### 6.3 全量内置后的文件关联形态

全量内置 34 个官方插件后：

1. 安装器会把各 app 插件的 `file-handler:<ext>` 能力自动注册到 Host；
2. 用户双击这些文件时，Host 会把文件路由到对应 app 插件；
3. 若某 app 插件未随包携带，对应的扩展名自然不会被注册，Host 也不会因为缺失而失败。

## 7. 当前边界

### 7.1 已闭环

当前已经闭环：

1. `.card` 固定注册；
2. 普通文件类型基于 `file-handler:<ext>` 的 app 插件分发；
3. 全量官方插件自动发现与内置打包（安装器侧）；
4. 内置插件动态自动发现与引导（Host 侧）；
5. 安装器 CLI 的 `--list-plugins` / `--skip-prerequisites` 参数。

### 7.2 尚未扩展

当前仍未扩展：

1. 多个同类文件处理器并存时的优先级治理；
2. 动态卸载插件后的系统级关联回收；
3. 非文件路径资源的跨应用票据化转交。

## 8. 验证

截至 2026-04-02，本链路已执行并通过：

1. `npm run build`
2. `npm test`
3. `npm run test:contract`

2026-08-12 预发布打包轮新增验证（全部通过）：

1. Host 全量测试 49 文件 / 355 用例全绿（含 macos-installer 7 用例、built-in-plugins 5 用例）；
2. `--list-plugins` 自动发现 34 个官方插件工程（9 app + 8 card + 10 layout + 7 module）；
3. 34 个插件 `build -> validate -> package` 全部成功，产出 34 个 `.cpk` 并归档；
4. `Chips.app` 内置 34 个插件，`builtin-plugins` 目录结构完整（manifest + dist + assets/contracts）；
5. 真实 Host 链路验证：34 个内置插件全部可 install + enable，设置面板保留快捷方式与首启标记；
6. `Info.plist` 自动注册 `.card`、`.box`、图片、书籍、音乐、视频等文件关联；
7. 真实 macOS `.pkg` 产物的 payload 与展开包目录均不含 `._*`、`.DS_Store`、`CodeResources`；
8. `macos-installer.test.ts` 适配 task030 决策（不再期待主题包），工单155 Host 侧遗留项闭环。
