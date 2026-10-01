import { isAbsolute } from 'node:path';

import type {
  DialogFileFilter,
  DialogOpenOptions,
  DialogOpenResult,
  DialogSaveOptions,
  DialogSaveResult,
  IPalDialogPort,
} from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import type { ElectronDialogLike } from '../electron/electron-api.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';

/** Electron 对话框过滤器形状。 */
interface ElectronFilter {
  readonly name: string;
  readonly extensions: readonly string[];
}

/**
 * 创建 macOS 对话框端口。
 *
 * 权威：`04-能力契约规范` §7.7。
 *
 * @param dialog Electron `dialog` 模块切片。
 * @returns `dialog:*` 端口实现。
 *
 * @remarks
 * - 用户取消不是错误：返回 `{ canceled: true }`。
 * - 用户选择不产生文件系统授权；端口只返回路径，不读写文件。
 * - 返回路径走文件域同源的系统级校验链（绝对路径断言，与 `storage` 端口同口径）：
 *   契约输出即"选中的绝对路径"，平台返回非绝对路径以 `DIALOG_FAILED` 如实拒绝。
 * - 过滤器扩展名从能力契约的 `.card` 形式归一为 Electron 的 `card` 形式。
 */
export function createMacDialogPort(dialog: ElectronDialogLike): IPalDialogPort {
  return {
    async open(options?: DialogOpenOptions): Promise<DialogOpenResult> {
      assertCallActive(options);
      try {
        const electronOptions = buildOpenOptions(options);
        const result = await dialog.showOpenDialog(electronOptions);
        if (result.canceled === true || !Array.isArray(result.filePaths)) {
          return { canceled: true, paths: [] };
        }
        const paths = [...(result.filePaths as readonly string[])];
        for (const path of paths) {
          assertAbsoluteResultPath(path);
        }
        return { canceled: false, paths };
      } catch (error) {
        throw normalizeDialogError(error);
      }
    },

    async save(options?: DialogSaveOptions): Promise<DialogSaveResult> {
      assertCallActive(options);
      try {
        const electronOptions = buildSaveOptions(options);
        const result = await dialog.showSaveDialog(electronOptions);
        if (result.canceled === true || typeof result.filePath !== 'string' || result.filePath.length === 0) {
          return { canceled: true, path: null };
        }
        assertAbsoluteResultPath(result.filePath);
        return { canceled: false, path: result.filePath };
      } catch (error) {
        throw normalizeDialogError(error);
      }
    },
  };
}

/** 返回路径绝对性断言（契约输出即"选中的绝对路径"）；非绝对路径以 `DIALOG_FAILED` 拒绝。 */
function assertAbsoluteResultPath(path: string): void {
  if (!isAbsolute(path)) {
    throw new PalPortError(PAL_ERROR_CODES.DIALOG_FAILED);
  }
}

/** 对话框失败归一；已归一的 `PalPortError`（如路径断言臂）原样透传。 */
function normalizeDialogError(error: unknown): PalPortError {
  return error instanceof PalPortError
    ? error
    : new PalPortError(PAL_ERROR_CODES.DIALOG_FAILED, undefined, { cause: error });
}

/** 构建打开对话框的 Electron 选项。 */
function buildOpenOptions(options?: DialogOpenOptions): Readonly<Record<string, unknown>> {
  const properties: string[] = [];
  if (options?.directory === true) {
    properties.push('openDirectory');
  } else {
    properties.push('openFile');
  }
  if (options?.multiple === true) {
    properties.push('multiSelections');
  }

  const electronOptions: Record<string, unknown> = { properties };
  if (options?.title !== undefined) {
    electronOptions['title'] = options.title;
  }
  const filters = normalizeFilters(options?.filters);
  if (filters !== undefined) {
    electronOptions['filters'] = filters;
  }
  return electronOptions;
}

/** 构建保存对话框的 Electron 选项。 */
function buildSaveOptions(options?: DialogSaveOptions): Readonly<Record<string, unknown>> {
  const electronOptions: Record<string, unknown> = {};
  if (options?.title !== undefined) {
    electronOptions['title'] = options.title;
  }
  if (options?.defaultPath !== undefined) {
    electronOptions['defaultPath'] = options.defaultPath;
  }
  const filters = normalizeFilters(options?.filters);
  if (filters !== undefined) {
    electronOptions['filters'] = filters;
  }
  return electronOptions;
}

/** 归一过滤器：能力契约使用带点号扩展名，Electron 使用不带点号扩展名。 */
function normalizeFilters(filters: readonly DialogFileFilter[] | undefined): readonly ElectronFilter[] | undefined {
  if (filters === undefined || filters.length === 0) {
    return undefined;
  }
  const normalized = filters.map((filter) => ({
    name: filter.name,
    extensions: filter.extensions.map((extension) => (extension.startsWith('.') ? extension.slice(1) : extension)),
  }));
  return normalized;
}
