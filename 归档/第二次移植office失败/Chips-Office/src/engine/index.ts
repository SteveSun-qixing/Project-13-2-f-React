/**
 * Chips-Office Engine - 统一导出入口（浏览器安全，工单172 分层收口）
 *
 * 分层边界：
 * - 浏览器侧：应用插件运行在宿主沙箱化的浏览器渲染进程（Electron sandbox: true，
 *   无 Node 能力）。本入口只导出浏览器安全的引擎包；浏览器侧代码禁止使用
 *   Buffer / node:* 内置模块，字节操作统一走 ./shared/bytes。
 * - 服务端侧：file-parse 的 Node 侧文本抽取管线（parse/doc/ppt/pptx/xlsx/vendor）
 *   与 font-metrics 的系统字体扫描依赖 node:fs 等 Node 内置模块，仅供服务端 /
 *   CLI 使用，保留在原目录，不在此导出，且禁止被浏览器侧代码引用。
 */

// DOCX 引擎 - 浏览器安全，完整重导出
// 注意：使用完整路径以避免与 pptx-engine 的命名冲突
export * as docxEngine from './docx-engine/src'

// PPTX 引擎 - 浏览器安全（不含 node-io），完整重导出
export * as pptxEngine from './pptx-engine/src'

// PPTX 渲染层 - 浏览器安全；原为顶层 `export *` 重导出，为避免与上述命名空间
// 导出产生命名冲突，改为命名空间形式，同时保持导出完整性
export * as pptxRender from './pptx-render/src'

// 文件解析 - 仅导出浏览器安全实现（PDF 文本抽取）；其中 pdf 依赖的 worker 与
// standard_fonts 资源由打包器以资产形式解析
export { pdfToText } from './file-parse/src/pdf'

// 以下两块为 Node 侧（服务端 / CLI）专用实现，位于原目录，不在此导出：
// - ./file-parse/src：Node 侧文本抽取管线（parse/doc/ppt/pptx/xlsx/vendor 等，
//   依赖 node:fs 等 Node 内置模块）
// - ./font-metrics/src：依赖 node:fs 扫描系统字体
