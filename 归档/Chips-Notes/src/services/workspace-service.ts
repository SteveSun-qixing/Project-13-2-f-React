/**
 * 工作区管理服务
 *
 * 工作目录是存放各笔记本（`.box` 文件）的普通目录：
 * - 配置通过 `client.config`（user 作用域）以对象形式持久化；
 * - 默认工作目录挂在 Host 工作区根路径下（`client.workspace.getContext()`）；
 * - 用户可通过系统目录选择对话框更换工作目录。
 */

import type { Client } from 'chips-sdk';
import { NOTES_CONFIG_KEY, WORKSPACE_DIR_NAME } from '../lib/constants';
import { DEFAULT_NOTES_CONFIG } from '../types/workspace';
import type { NotesConfig } from '../types';

/**
 * 读取工作区配置
 */
export async function getWorkspaceConfig(client: Client): Promise<NotesConfig | null> {
  try {
    const config = await client.config.get<NotesConfig>(NOTES_CONFIG_KEY);
    if (config && typeof config.workspacePath === 'string' && config.workspacePath) {
      return config;
    }
  } catch {
    // 配置不存在或读取失败
  }
  return null;
}

/**
 * 保存工作区配置（user 作用域）
 */
export async function saveWorkspaceConfig(client: Client, config: NotesConfig): Promise<void> {
  await client.config.set(NOTES_CONFIG_KEY, config, { scope: 'user' });
}

/**
 * 获取默认工作目录路径（Host 工作区根路径下的 ChipsNotes 目录）
 */
export async function getDefaultWorkspacePath(client: Client): Promise<string> {
  const context = await client.workspace.getContext();
  return `${context.rootPath}/${WORKSPACE_DIR_NAME}`;
}

/**
 * 确保工作目录存在
 */
export async function ensureWorkspaceExists(client: Client, workspacePath: string): Promise<void> {
  try {
    const stat = await client.file.stat(workspacePath);
    if (!stat.isDirectory) {
      throw new Error('工作目录路径已被文件占用');
    }
  } catch {
    // 目录不存在，创建它
    await client.file.mkdir(workspacePath, { recursive: true });
  }
}

/**
 * 打开系统目录选择对话框，返回用户选择的工作目录
 */
export async function selectWorkspace(client: Client): Promise<string | null> {
  const selected = await client.platform.openFile({
    title: '选择工作目录',
    mode: 'directory',
    allowMultiple: false,
    mustExist: true,
  });
  return selected?.[0] ?? null;
}

/**
 * 创建默认工作区配置
 */
export function createDefaultConfig(workspacePath: string): NotesConfig {
  return {
    workspacePath,
    ...DEFAULT_NOTES_CONFIG,
  };
}
