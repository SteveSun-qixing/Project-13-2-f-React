/**
 * 笔记本（箱子）管理服务
 *
 * 每个笔记本是一个符合《Chips 箱子文件规范》的 `.box` 文件（ZIP Store 包），
 * 全部操作通过 chips-sdk 的 `client.box.*` 正式链路完成：
 * - 创建：box.session.create（文档库布局箱子）
 * - 打开编辑会话：box.session.open（Host 解包到会话工作目录）
 * - 读取元数据：box.readMetadata（轻量读取，不解包全部内容）
 * - 重命名：box.session.rename
 * - 删除：file.delete（箱子是普通文件）
 */

import type { Client } from 'chips-sdk';
import {
  NOTEBOOK_FILE_EXTENSION,
  NOTEBOOK_LAYOUT_FALLBACK,
  NOTEBOOK_LAYOUT_TYPE,
} from '../lib/constants';
import type { Notebook } from '../types';

/**
 * 读取文本文件（client.file.read 可能返回 Uint8Array）
 */
export async function readTextFile(client: Client, path: string): Promise<string> {
  const content = await client.file.read(path, { encoding: 'utf-8' });
  if (typeof content === 'string') {
    return content;
  }
  return new TextDecoder('utf-8').decode(content);
}

/**
 * 判断路径是否为内嵌文档的包内相对路径（不以协议开头）
 */
export function isEmbeddedUrl(url: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:\/\//i.test(url);
}

/**
 * 列出工作目录中的全部笔记本
 * 读取失败的箱子跳过（宽松解析，避免单个损坏文件阻塞整个列表）
 */
export async function listNotebooks(client: Client, workspacePath: string): Promise<Notebook[]> {
  const entries = await client.file.list(workspacePath);
  const notebooks: Notebook[] = [];

  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith(NOTEBOOK_FILE_EXTENSION)) {
      continue;
    }
    try {
      const metadata = await client.box.readMetadata(entry.path);
      notebooks.push({
        id: metadata.boxId,
        name: metadata.name,
        path: entry.path,
        modifiedAt: metadata.modifiedAt,
      });
    } catch {
      // 无法解析的箱子文件跳过
    }
  }

  notebooks.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return notebooks;
}

/**
 * 解析创建笔记本使用的布局类型
 * 首选文档库布局；该布局插件未安装时回退到已注册的备用布局
 */
async function resolveNotebookLayoutType(client: Client): Promise<string> {
  const descriptors = await client.box.listLayoutDescriptors();
  if (descriptors.some((descriptor) => descriptor.layoutType === NOTEBOOK_LAYOUT_TYPE)) {
    return NOTEBOOK_LAYOUT_TYPE;
  }
  if (descriptors.some((descriptor) => descriptor.layoutType === NOTEBOOK_LAYOUT_FALLBACK)) {
    return NOTEBOOK_LAYOUT_FALLBACK;
  }
  throw new Error('当前 Host 没有可用的箱子布局插件，无法创建笔记本');
}

/**
 * 创建笔记本（首选文档库布局箱子）
 */
export async function createNotebook(
  client: Client,
  workspacePath: string,
  name: string,
): Promise<Notebook> {
  const layoutType = await resolveNotebookLayoutType(client);
  const result = await client.box.session.create(name, layoutType, workspacePath);
  return {
    id: result.metadata.boxId,
    name: result.metadata.name,
    path: result.boxFile,
    modifiedAt: result.metadata.modifiedAt,
  };
}

/**
 * 重命名笔记本（重写箱子 metadata 并重命名文件）
 * 返回重命名后的笔记本信息（文件路径会变化）
 */
export async function renameNotebook(
  client: Client,
  notebook: Notebook,
  newName: string,
): Promise<Notebook> {
  const result = await client.box.session.rename(notebook.path, newName);
  return {
    id: result.metadata.boxId,
    name: result.metadata.name,
    path: result.boxFile,
    modifiedAt: result.metadata.modifiedAt,
  };
}

/**
 * 删除笔记本（删除 `.box` 文件本身）
 */
export async function deleteNotebook(client: Client, notebook: Notebook): Promise<void> {
  await client.file.delete(notebook.path, { recursive: true });
}
