// 源码只做拆分导出（08-基础卡片插件接口 §2.5）：构建以 src/main.ts 生成 dist/index.js、以 src/render.tsx 生成 render.js。
export { validateConfig, createInitialContent, collectResourcePaths } from './main';
export { renderView, renderEditor, renderPlugin } from './render';
export { default } from './render';

// 共享元数据解析公开导出（src/shared/ 家族资产，自旧族 music-BCP 逐字迁移并测毕）：
// 供音乐播放器应用（chips.official.music-player）经 workspace 依赖复用，
// 禁止在各包内出现第二份音频标签解析拷贝（W5 迁移复用红线，收口 mp G-3 双解析源张力）。
export { parseEmbeddedAudioMetadata, type EmbeddedAudioMetadata, type EmbeddedArtwork } from './shared/audio-metadata';
