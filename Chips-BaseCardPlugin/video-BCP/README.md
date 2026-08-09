# 视频基础卡片插件

> 插件 ID：`chips.basecard.video`

`video-BCP` 是薯片生态的官方视频基础卡片插件。项目由基础卡片脚手架初始化后，按视频卡片正式口径完成了查看态、编辑态、资源链路、界面文案与测试闭环；UI 组件基于 Ant Design（`antd`），查看态与编辑面板入口统一套用共享层苹果主题 `appleTheme`（`@chips/ui`），视觉与文案规范遵循 `项目日志与笔记/task030-卸担计划/` 03 / 04 / 06 / 07 章。

## 当前能力

- 支持基础卡片类型：`base.video`
- 正式配置字段：
  - `video_file`
  - `cover_image`
  - `subtitles`
  - `playback`
  - `video_title`
  - `publish_time`
  - `creator`
- 查看态直接显示视频封面；未填写封面时回退到视频第一帧
- 鼠标悬浮时显示黑色半透明遮罩与播放图标
- 点击视频封面时通过宿主 `openResource(...)` 统一上抛，最终走 Host `resource.open` 路由到视频播放器
- 编辑态上传视频后只导入视频资源并清空旧封面；自动缩略图生成等待 Host/模块正式能力
- 编辑页采用标题分组 + 列表行布局，适合侧栏和窄窗口
- 资源区支持点击或拖拽上传，也支持通过 URL 导入
- 上传后的资源区直接显示视频/封面预览，并在悬浮时显示删除按钮
- 手动封面上传、替换、移除与元信息编辑
- 字幕资源上传、URL 导入、替换、删除与默认字幕设置
- 播放入口参数编辑：自动播放、循环、静音、默认倍速和起始秒数
- 元信息输入改为离开输入区后再提交，避免每次按键都触发预览刷新
- Schema 会拒绝绝对路径、`file://`、`blob:`、`data:`、查询串、片段和 `..` 逃逸路径

## 工程结构

```text
video-BCP/
├─ manifest.yaml
├─ package.json
├─ chips.config.mjs
├─ src/
│  ├─ index.ts
│  ├─ lib/
│  │  └─ messages.ts
│  ├─ schema/card-config.ts
│  ├─ render/
│  │  ├─ runtime.ts
│  │  └─ view.tsx
│  ├─ editor/
│  │  ├─ runtime.ts
│  │  └─ panel.tsx
│  └─ shared/
│     └─ utils.ts
├─ 归档/
├─ templates/
└─ tests/
```

## 开发命令

```bash
cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048
npm install
cd Chips-BaseCardPlugin/video-BCP
npm run dev
```

常用脚本：

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run validate`

## 配置示例

```yaml
card_type: "VideoCard"
theme: ""
video_file: "travel-vlog.mp4"
cover_image: "travel-vlog-cover.jpg"
subtitles:
  - id: "zh-cn"
    label: "简体中文"
    language: "zh-CN"
    kind: "subtitles"
    file_path: "travel-vlog.zh.vtt"
    default: true
playback:
  autoplay: false
  loop: false
  muted: false
  playback_rate: 1
  start_time: 0
video_title: "东京旅行记录"
publish_time: "2026-04-18"
creator: "薯片工作室"
```

参数说明见 [templates/parameters.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/video-BCP/templates/parameters.md)。

## 正式导出

- `renderBasecardView(ctx)`
- `renderBasecardEditor(ctx)`
- `basecardDefinition`

其中：

- `basecardDefinition.cardType = "base.video"`
- `basecardDefinition.aliases = ["VideoCard"]`
- `basecardDefinition.previewPointerEvents = "shielded"`
- `collectResourcePaths(...)` 会收集 `video_file`、`cover_image` 与全部字幕内部资源路径
- 查看态 `openResource(...)` 会使用主视频卡片根目录相对路径作为 `resourceId`，并通过 `chips.video-card` payload 透传封面、字幕和播放入口上下文

## 媒体预处理边界

当前生态尚未提供正式 Host/模块级视频首帧抽取或缩略图生成能力，该缺口已登记为 `工单108-视频资源首帧封面与缩略图正式模块能力缺口`。因此本插件不在正式代码中维护浏览器端抽帧算法；查看态只在没有 `cover_image` 时使用视频元素显示首帧回退，持久化封面必须通过手动封面导入或后续正式模块能力完成。
