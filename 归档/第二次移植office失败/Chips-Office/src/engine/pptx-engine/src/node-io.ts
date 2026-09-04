/**
 * Node 侧专用 IO 入口（工单172 架构分层）。
 *
 * 引擎插件运行在宿主沙箱化的浏览器渲染进程（Electron sandbox: true，无 Node
 * 能力），主入口 index.ts 不得引用任何 node:* 内置模块；本文件收敛 Node 专属
 * 能力（流式写盘），仅供服务端 / CLI / 测试场景使用，浏览器代码禁止引用本
 * 文件（不得进入浏览器构建）。
 *
 * 浏览器侧保存请使用 index.ts 的 `savePptx`（返回 Uint8Array，走 file.* 会话
 * 链路写回）。
 */
import { buildZip, type OpenedPptx } from './index'

/**
 * Same output as savePptx, written straight to `filePath`.
 *
 * Prefer this for anything that lands on disk: savePptx has to assemble the whole
 * package into one contiguous buffer, which on a large deck fails outright with
 * "Array buffer allocation failed". Streaming keeps peak memory to a chunk at a
 * time. JSZip throws stream errors from inside its own scheduled callbacks, so the
 * stream's 'error' event — not just the returned promise — has to be handled or the
 * throw escapes as an uncaught exception and takes the process down.
 */
export async function savePptxToFile(opened: OpenedPptx, filePath: string): Promise<void> {
  const { createWriteStream } = await import('node:fs')
  const { pipeline } = await import('node:stream/promises')
  const source = buildZip(opened).generateNodeStream({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    streamFiles: true,
  })
  await pipeline(source, createWriteStream(filePath))
}
