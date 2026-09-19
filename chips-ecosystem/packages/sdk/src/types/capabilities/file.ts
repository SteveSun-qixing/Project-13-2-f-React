/**
 * `file:*` 能力契约类型（04-能力契约规范 §7.1）。
 *
 * 使用路径访问，与 `chips-resource://` 句柄路径分属两套权限；
 * 大文件与流式读取使用 `chips.resource(uri)`，不经 `file:read`。
 */

export interface IFileReadInput {
  path: string;
  encoding?: 'utf-8' | 'base64';
}

export interface IFileReadOutput {
  content: string;
  encoding: 'utf-8' | 'base64';
}

export interface IFileListInput {
  directory: string;
  recursive?: boolean;
}

export interface IFileListOutput {
  entries: string[];
}

export interface IFileWatchInput {
  path: string;
  recursive?: boolean;
}

export interface IFileWatchOutput {
  watchId: string;
}

export interface IFileWriteInput {
  path: string;
  data: string;
  encoding?: 'utf-8' | 'base64';
}

export interface IFileDeleteInput {
  path: string;
  recursive?: boolean;
}

export interface IFileMoveInput {
  source: string;
  target: string;
  overwrite?: boolean;
}

export interface IFileCopyInput {
  source: string;
  target: string;
  overwrite?: boolean;
}

export interface IFileMkdirInput {
  path: string;
  recursive?: boolean;
}
