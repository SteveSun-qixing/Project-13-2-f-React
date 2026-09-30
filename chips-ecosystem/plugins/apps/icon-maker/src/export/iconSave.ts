/**
 * 生成产物落盘臂：经 `file:*` 正式能力链写入用户空间。
 *
 * 诚实降级口径（W5 派单 #6）：filesystem 域宿主处理器未就绪（工单061 在册）——
 * `file:mkdir` / `file:write` 调用会以 ChipsError 拒绝；本模块把每一次失败如实上报
 * （状态、错误码、已写入清单），禁止以任何形式伪造成功。预览与产物字节生成不依赖本臂。
 */

import { chips, ChipsError } from '@chips/sdk';
import type { BinaryIconFile } from '../domain/types';

/** 落盘结果：`failed` 时 `errorCode` 必非空且 `message` 说明真实原因。 */
export interface IconSaveResult {
  readonly status: 'written' | 'failed';
  readonly outputDir: string;
  readonly writtenPaths: readonly string[];
  readonly errorCode: string | null;
  readonly message: string;
}

/** 读取错误对象上的结构化错误码（ChipsError 或带 code 的普通对象）。 */
export function resolveErrorCode(error: unknown): string | null {
  if (error instanceof ChipsError) {
    return error.code;
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return null;
}

/** 去除目录尾部分隔符并以 POSIX 分隔符拼接输出路径（与旧 CLI 臂 joinPath 口径一致）。 */
export function joinOutputPath(directory: string, fileName: string): string {
  return `${directory.replace(/[\\/]+$/g, '')}/${fileName}`;
}

/** 图标字节转 base64（`file:write` 契约的二进制载荷形态；分块避免超长字符串拼接溢出）。 */
export function iconBytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * 把生成产物逐个写入 `outputDir`。
 *
 * 目录创建与文件写入都走 `file:mkdir` / `file:write` 正式能力；任一步失败即停止并
 * 返回 `failed` 结果（含错误码与已完成清单），不抛出、不重试、不伪造成功。
 */
export async function saveGeneratedIcons(
  files: readonly BinaryIconFile[],
  outputDir: string,
): Promise<IconSaveResult> {
  const writtenPaths: string[] = [];

  try {
    await chips.request('file:mkdir', { path: outputDir, recursive: true });

    for (const file of files) {
      const targetPath = joinOutputPath(outputDir, file.fileName);
      await chips.request('file:write', {
        path: targetPath,
        data: iconBytesToBase64(file.bytes),
        encoding: 'base64',
      });
      writtenPaths.push(targetPath);
    }
  } catch (error: unknown) {
    const errorCode = resolveErrorCode(error) ?? 'ICON_SAVE_UNKNOWN_ERROR';
    return {
      status: 'failed',
      outputDir,
      writtenPaths,
      errorCode,
      message: `落盘未完成：写入能力返回错误（${errorCode}）。产物仍在预览中，未写入任何虚假成功状态。`,
    };
  }

  return {
    status: 'written',
    outputDir,
    writtenPaths,
    errorCode: null,
    message: `已写入 ${writtenPaths.length} 个文件到 ${outputDir}。`,
  };
}
