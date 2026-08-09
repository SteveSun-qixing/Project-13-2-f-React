# 音乐基础卡片插件

音乐基础卡片插件（`chips.basecard.music`）用于在复合卡片中保存和展示音频资源。插件基于基础卡片脚手架初始化，并按新基础卡片契约接入了卡片根目录资源链路、Ant Design 控件、编辑面板、查看态与测试体系。

当前正式入口契约为：

- `renderBasecardView(ctx)`：供 Host 通用查看链路与编辑引擎单卡 iframe 复用。
- `renderBasecardEditor(ctx)`：供 Host 托管编辑器与编辑引擎本地编辑面板复用。
- `basecardDefinition`：供编辑引擎运行时注册表读取 `pluginId/cardType/aliases/collectResourcePaths` 与渲染能力。
- 查看态在宿主提供 `openResource(...)` 时，会把音频资源打开意图交给外层容器统一走 `resource.open`。

## 当前能力

- 查看态以长条音乐卡片展示专辑封面、歌曲名、歌手与补充信息。
- 查看态封面和空态使用 antd 的 `Image` / `Empty`，视觉统一为共享层苹果主题（`@chips/ui` 的 `appleTheme`）固定色值。
- 查看态取消右侧播放图标与操作按钮，整张卡片直接承担点击打开行为。
- 若未上传专辑封面，查看态与编辑态都会回退到插件内置的默认占位封面图。
- 点击查看态卡片时，会把音频资源打开请求交给内核统一路由到音乐播放器。
- 编辑态支持：
  - 音频文件导入与替换
  - 上传音频后自动解析内嵌标题、歌手、专辑名、封面与歌词
  - 将音频内嵌封面抽取为独立图片文件，再写回 `album_cover`
  - 当前正式覆盖 MP3 ID3v2、FLAC、M4A/MP4 元数据中的标题、歌手、专辑、封面与歌词信息
  - 封面手动上传、替换、删除
  - 歌词文件手动上传、替换、删除
  - 制作团队多身份编辑，每个身份支持多人
  - 发行日期、专辑名字、语种、流派编辑
  - 在未先上传音频时，歌曲名、专辑名、语种、流派等可选字段仍可先行编辑并正式输出配置
  - 编辑面板改为与视频基础卡片一致的“分组标题 + 列表行 + 资源预览项”结构
  - 资源存在时显示预览项，缺失时切换为上传面，适配窄窗口与移动端比例编辑面板
  - 编辑表单、音频预览、状态进度、团队添加按钮、错误态和删除按钮接入 antd `Form`（受控 State 做法 A）、原生 `audio`、`Progress`、`Space`/`Button`、`Result`
- 界面文案：
  - 简体中文直写（task030 后全生态统一），文案总表见 `src/lib/messages.ts`

## 资源规则

- `audio_file`、`album_cover`、`lyrics_file` 统一记录为相对于卡片根目录的路径。
- 自动抽取的封面会作为单独图片资源保存，不以内嵌 blob/data URL 形式留在配置里。
- 默认占位封面图属于插件包静态资源，不写入卡片配置，也不进入卡片根目录资源清单。
- 插件不会把内部资源写入 `content/` 或其他临时目录，也不会把 `blob:`、`data:`、系统绝对路径写回配置。
- 编辑态所有导入、解析、释放、删除都通过宿主正式资源桥完成：
  - `importResource(...)`
  - `resolveResourceUrl(...)`
  - `releaseResourceUrl(...)`
  - `deleteResource(...)`
  - `convertTiffToPng(...)`

## 配置模型

```yaml
card_type: "MusicCard"
theme: ""
audio_file: "tracks/demo.mp3"
music_name: "Midnight Echo"
album_cover: "tracks/demo-cover.jpg"
lyrics_file: "tracks/demo-lyrics.lrc"
production_team:
  - id: "team-a1b2c3"
    role: "歌手"
    people:
      - "Alice"
      - "Bob"
  - id: "team-d4e5f6"
    role: "作曲"
    people:
      - "Caro"
release_date: "2026-04-18"
album_name: "Northern Lights"
language: "日语"
genre: "流行"
```

正式类型定义见 [src/schema/card-config.ts](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/music-BCP/src/schema/card-config.ts)。

## 目录结构

```text
music-BCP/
├─ src/
│  ├─ index.ts
│  ├─ lib/
│  │  └─ messages.ts
│  ├─ editor/
│  │  ├─ panel.tsx
│  │  └─ runtime.ts
│  ├─ render/
│  │  ├─ view.tsx
│  │  └─ runtime.ts
│  ├─ schema/
│  │  └─ card-config.ts
│  └─ shared/
│     ├─ audio-metadata.ts
│     ├─ default-cover.ts
│     └─ utils.ts
├─ 归档/
├─ templates/
├─ docs/
└─ tests/
```

## 技术栈

- React 运行时；UI 组件基于 Ant Design（`antd`），编辑器面板入口统一套用共享层苹果主题 `appleTheme`（`@chips/ui`），视觉与文案规范遵循 `项目日志与笔记/task030-卸担计划/` 03 / 04 / 06 / 07 章。
- 卡片格式契约（`.card` 序列化字段、`basecardDefinition`、Host 资源桥链路）不依赖任何 UI 框架，保持独立。

## 开发与验证

在插件目录执行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

## 相关文档

- 需求规格：[docs/requirements/01-需求规格说明书.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/music-BCP/docs/requirements/01-需求规格说明书.md)
- 架构设计：[docs/technical/01-架构设计.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/music-BCP/docs/technical/01-架构设计.md)
- 数据模型：[docs/technical/02-数据模型设计.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/music-BCP/docs/technical/02-数据模型设计.md)
