/**
 * 笔记本编辑会话注册表
 *
 * 通过 `client.box.session.open` 打开箱子编辑会话（Host 解包到会话工作目录），
 * 并在应用内维护 boxFile → 会话 的映射，避免重复开关会话。
 * 会话工作目录（workspaceDir）由 Host 分配，内嵌卡片在该目录内可直接读写。
 */

import type { Client } from 'chips-sdk';

export interface NotebookSession {
  /** 箱子编辑会话 ID */
  sessionId: string;
  /** 箱子 ID */
  boxId: string;
  /** 箱子文件路径 */
  boxFile: string;
  /** Host 会话工作目录（解包态箱子根目录） */
  workspaceDir: string;
}

const sessionsByBoxFile = new Map<string, NotebookSession>();

/**
 * 确保箱子编辑会话已打开（同一箱子复用 Host 会话）
 */
export async function ensureNotebookSession(
  client: Client,
  boxFile: string,
): Promise<NotebookSession> {
  const existing = sessionsByBoxFile.get(boxFile);
  if (existing) {
    return existing;
  }

  const { sessionId, snapshot } = await client.box.session.open(boxFile);
  const session: NotebookSession = {
    sessionId,
    boxId: snapshot.boxId,
    boxFile,
    workspaceDir: snapshot.workspaceDir,
  };
  sessionsByBoxFile.set(boxFile, session);
  return session;
}

/**
 * 读取已打开的会话（不触发打开）
 */
export function getNotebookSession(boxFile: string): NotebookSession | undefined {
  return sessionsByBoxFile.get(boxFile);
}

/**
 * 关闭箱子编辑会话（Host 会清理会话工作目录）
 */
export async function closeNotebookSession(client: Client, boxFile: string): Promise<void> {
  const session = sessionsByBoxFile.get(boxFile);
  if (!session) {
    return;
  }
  sessionsByBoxFile.delete(boxFile);
  try {
    await client.box.session.close(session.sessionId);
  } catch {
    // 会话可能已被 Host 侧回收
  }
}

/**
 * 关闭全部箱子编辑会话
 */
export async function closeAllNotebookSessions(client: Client): Promise<void> {
  const boxFiles = [...sessionsByBoxFile.keys()];
  for (const boxFile of boxFiles) {
    await closeNotebookSession(client, boxFile);
  }
}
