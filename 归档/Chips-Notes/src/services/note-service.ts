/**
 * 笔记卡片管理服务
 *
 * 每篇笔记是一个符合《Chips 卡片文件规范》的富文本复合卡片（base.richtext），
 * 以内嵌卡片形式保存在笔记本（`.box` 箱子）内。全部操作通过正式链路完成：
 * - 读取：从 Host 会话工作目录取内嵌卡片 → `card.unpack` 到应用运行时目录 → 解析 YAML
 * - 保存：在运行时目录重建卡片文件 → `card.pack` 回写内嵌卡片 → 同步箱子条目摘要 → `box.session.persist`
 * - 新建：运行时目录构建卡片 → `card.pack` 出临时 `.card` → `box.session.addEmbeddedCard` 内嵌进箱子
 * - 删除：`box.session.removeEntry` + 删除包内嵌卡片文件 → `box.session.persist`
 */

import type { BoxEntrySnapshot, Client } from 'chips-sdk';
import YAML from 'yaml';
import {
  NOTE_FILE_EXTENSION,
  NOTE_SUMMARY_MAX_LENGTH,
  RUNTIME_DIR_NAME,
} from '../lib/constants';
import { generateDocumentId } from '../lib/id';
import { extractSummary } from '../lib/markdown-text';
import { isEmbeddedUrl, readTextFile } from './notebook-service';
import { ensureNotebookSession } from './session-registry';
import { buildRichTextCardFiles, parseRichTextCardFiles } from './richtext-card';
import type { Note, NoteDocument, Notebook } from '../types';

/** 笔记加载结果 */
export interface NoteLoadResult {
  /** 解析后的笔记文档 */
  document: NoteDocument;
  /** 会话 ID（保存时复用） */
  sessionId: string;
  /** 运行时卡片目录（解包态） */
  cardDir: string;
}

/**
 * 从箱子条目推导笔记标题
 */
function deriveTitleFromUrl(url: string): string {
  const fileName = url.split('/').pop() ?? url;
  return fileName.endsWith(NOTE_FILE_EXTENSION)
    ? fileName.slice(0, -NOTE_FILE_EXTENSION.length)
    : fileName;
}

/**
 * 判断条目是否为本应用的笔记（内嵌 .card 卡片）
 */
function isNoteEntry(entry: BoxEntrySnapshot): boolean {
  return entry.enabled !== false && isEmbeddedUrl(entry.url) && entry.url.endsWith(NOTE_FILE_EXTENSION);
}

/**
 * 从箱子会话快照构建笔记列表（按标题拼音升序）
 */
export function notesFromSnapshot(notebook: Notebook, entries: BoxEntrySnapshot[]): Note[] {
  return entries
    .filter(isNoteEntry)
    .map((entry) => ({
      entryId: entry.entryId,
      cardId: entry.snapshot.documentId,
      notebookId: notebook.id,
      notebookPath: notebook.path,
      url: entry.url,
      title: entry.snapshot.title || deriveTitleFromUrl(entry.url),
      summary: entry.snapshot.summary ?? '',
      modifiedAt: entry.snapshot.lastKnownModifiedAt ?? '',
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
}

/**
 * 列出笔记本中的全部笔记（打开箱子编辑会话并读取条目快照）
 */
export async function listNotes(client: Client, notebook: Notebook): Promise<Note[]> {
  const session = await ensureNotebookSession(client, notebook.path);
  const snapshot = await client.box.session.get(session.sessionId);
  return notesFromSnapshot(notebook, snapshot.entries);
}

/**
 * 计算笔记在箱子包内的完整路径
 */
function resolveEmbeddedCardPath(workspaceDir: string, url: string): string {
  return `${workspaceDir}/${url}`;
}

/**
 * 计算笔记运行时目录（解包态卡片所在目录）
 */
function resolveNoteRuntimeDir(workspacePath: string, notebookId: string, entryId: string): string {
  return `${workspacePath}/${RUNTIME_DIR_NAME}/${notebookId}/${entryId}/card`;
}

/**
 * 读取卡片运行时目录中的 base.richtext 配置内容
 */
async function readNoteDocument(
  client: Client,
  cardDir: string,
  markdownResourceContent?: string,
): Promise<NoteDocument> {
  const metadataYaml = await readTextFile(client, `${cardDir}/.card/metadata.yaml`);
  const structureYaml = await readTextFile(client, `${cardDir}/.card/structure.yaml`);

  const structure = YAML.parse(structureYaml) as {
    structure?: Array<{ id?: string }>;
  };
  const baseCardId = structure.structure?.[0]?.id ?? '';
  if (!baseCardId) {
    throw new Error('卡片 structure.yaml 缺少基础卡片 ID');
  }

  const contentYaml = await readTextFile(client, `${cardDir}/content/${baseCardId}.yaml`);
  return parseRichTextCardFiles({
    metadataYaml,
    structureYaml,
    contentYaml,
    markdownResourceContent,
  });
}

/**
 * 加载笔记：解包内嵌卡片到运行时目录并解析内容
 */
export async function loadNote(
  client: Client,
  workspacePath: string,
  note: Note,
): Promise<NoteLoadResult> {
  const session = await ensureNotebookSession(client, note.notebookPath);
  const embeddedCardPath = resolveEmbeddedCardPath(session.workspaceDir, note.url);
  const cardDir = resolveNoteRuntimeDir(workspacePath, note.notebookId, note.entryId);

  // 重建运行时目录，保证与箱子内嵌卡片一致
  await client.file.delete(cardDir, { recursive: true }).catch(() => undefined);
  await client.file.mkdir(cardDir, { recursive: true });
  await client.card.unpack(embeddedCardPath, cardDir);

  const document = await readNoteDocument(client, cardDir);

  // file 存储模式：读取卡片根目录下的 .md 资源
  let markdownResourceContent: string | undefined;
  if (document.config.content_source === 'file' && document.config.content_file) {
    markdownResourceContent = await readTextFile(client, `${cardDir}/${document.config.content_file}`);
    document.markdown = markdownResourceContent;
  }

  return {
    document,
    sessionId: session.sessionId,
    cardDir,
  };
}

/**
 * 向运行时卡片目录写入全套卡片文件
 */
async function writeCardFiles(
  client: Client,
  cardDir: string,
  input: {
    cardId: string;
    baseCardId: string;
    title: string;
    createdAt: string;
    modifiedAt: string;
    markdown: string;
  },
): Promise<void> {
  const files = buildRichTextCardFiles(input);

  await client.file.mkdir(`${cardDir}/.card`, { recursive: true });
  await client.file.mkdir(`${cardDir}/content`, { recursive: true });
  await client.file.write(`${cardDir}/.card/metadata.yaml`, files.metadataYaml);
  await client.file.write(`${cardDir}/.card/structure.yaml`, files.structureYaml);
  await client.file.write(`${cardDir}/.card/cover.html`, files.coverHtml);
  await client.file.write(`${cardDir}/content/${input.baseCardId}.yaml`, files.contentYaml);

  if (files.markdownResource) {
    const resourceDir = files.markdownResource.path.split('/').slice(0, -1).join('/');
    if (resourceDir) {
      await client.file.mkdir(`${cardDir}/${resourceDir}`, { recursive: true });
    }
    await client.file.write(`${cardDir}/${files.markdownResource.path}`, files.markdownResource.content);
  }
}

/**
 * 删除 file 存储模式遗留的 Markdown 资源文件
 */
async function removeStaleMarkdownResource(
  client: Client,
  cardDir: string,
  document: NoteDocument,
  nextBaseCardId: string,
): Promise<void> {
  if (document.config.content_source !== 'file' || !document.config.content_file) {
    return;
  }
  const previousPath = document.config.content_file;
  const nextPath = `richtext/${nextBaseCardId}.md`;
  if (previousPath === nextPath) {
    return;
  }
  await client.file.delete(`${cardDir}/${previousPath}`).catch(() => undefined);
}

/**
 * 创建笔记：构建卡片 → 内嵌进箱子
 */
export async function createNote(
  client: Client,
  workspacePath: string,
  notebook: Notebook,
  title: string,
): Promise<Note> {
  const session = await ensureNotebookSession(client, notebook.path);
  const previousEntryIds = new Set(
    (await client.box.session.get(session.sessionId)).entries.map((entry) => entry.entryId),
  );

  const runtimeRoot = `${workspacePath}/${RUNTIME_DIR_NAME}`;
  const stagingId = `staging-${Date.now()}-${generateDocumentId()}`;
  const stagingDir = `${runtimeRoot}/${stagingId}`;
  const stagingCardFile = `${runtimeRoot}/${stagingId}${NOTE_FILE_EXTENSION}`;

  const timestamp = new Date().toISOString();
  const cardId = generateDocumentId();
  const baseCardId = generateDocumentId();

  try {
    await client.file.mkdir(stagingDir, { recursive: true });
    await writeCardFiles(client, stagingDir, {
      cardId,
      baseCardId,
      title,
      createdAt: timestamp,
      modifiedAt: timestamp,
      markdown: '',
    });
    await client.card.pack(stagingDir, stagingCardFile);
    await client.box.session.addEmbeddedCard(session.sessionId, stagingCardFile, title);
  } finally {
    await client.file.delete(stagingDir, { recursive: true }).catch(() => undefined);
    await client.file.delete(stagingCardFile).catch(() => undefined);
  }

  await client.box.session.persist(session.sessionId);

  const snapshot = await client.box.session.get(session.sessionId);
  const added = snapshot.entries.find((entry) => !previousEntryIds.has(entry.entryId));
  if (!added) {
    throw new Error('创建笔记失败：箱子条目未生成');
  }

  return {
    entryId: added.entryId,
    cardId: added.snapshot.documentId,
    notebookId: notebook.id,
    notebookPath: notebook.path,
    url: added.url,
    title: added.snapshot.title || title,
    summary: added.snapshot.summary ?? '',
    modifiedAt: added.snapshot.lastKnownModifiedAt ?? timestamp,
  };
}

/**
 * 保存笔记：重建卡片文件 → 回写内嵌卡片 → 同步条目摘要 → 持久化箱子
 */
export async function saveNote(
  client: Client,
  workspacePath: string,
  note: Note,
  markdown: string,
  options?: { title?: string },
): Promise<Note> {
  const session = await ensureNotebookSession(client, note.notebookPath);
  const embeddedCardPath = resolveEmbeddedCardPath(session.workspaceDir, note.url);
  const cardDir = resolveNoteRuntimeDir(workspacePath, note.notebookId, note.entryId);

  // 运行时目录不存在时先解包，保证元数据完整
  let document: NoteDocument;
  try {
    document = await readNoteDocument(client, cardDir);
  } catch {
    document = (await loadNote(client, workspacePath, note)).document;
  }

  const timestamp = new Date().toISOString();
  const title = options?.title ?? note.title;

  await removeStaleMarkdownResource(client, cardDir, document, document.baseCardId);
  await writeCardFiles(client, cardDir, {
    cardId: document.cardId || note.cardId || generateDocumentId(),
    baseCardId: document.baseCardId,
    title,
    createdAt: document.createdAt || timestamp,
    modifiedAt: timestamp,
    markdown,
  });
  await client.card.pack(cardDir, embeddedCardPath);

  // 同步箱子条目摘要快照（snapshot 为整体替换，需携带完整字段）
  const snapshot = await client.box.session.get(session.sessionId);
  const entry = snapshot.entries.find((item) => item.entryId === note.entryId);
  if (entry) {
    await client.box.session.updateEntry(session.sessionId, note.entryId, {
      snapshot: {
        ...entry.snapshot,
        documentId: document.cardId || entry.snapshot.documentId,
        title,
        summary: extractSummary(markdown, NOTE_SUMMARY_MAX_LENGTH),
        lastKnownModifiedAt: timestamp,
      },
    });
  }

  await client.box.session.persist(session.sessionId);

  return {
    ...note,
    title,
    summary: extractSummary(markdown, NOTE_SUMMARY_MAX_LENGTH),
    modifiedAt: timestamp,
  };
}

/**
 * 重命名笔记：更新卡片 metadata.name 与箱子条目标题
 */
export async function renameNote(
  client: Client,
  workspacePath: string,
  note: Note,
  newTitle: string,
): Promise<Note> {
  const loaded = await loadNote(client, workspacePath, note);
  return saveNote(client, workspacePath, note, loaded.document.markdown, { title: newTitle });
}

/**
 * 删除笔记：移除箱子条目并清理包内嵌卡片文件
 */
export async function deleteNote(client: Client, workspacePath: string, note: Note): Promise<void> {
  const session = await ensureNotebookSession(client, note.notebookPath);
  await client.box.session.removeEntry(session.sessionId, note.entryId);
  await client.file
    .delete(resolveEmbeddedCardPath(session.workspaceDir, note.url), { recursive: true })
    .catch(() => undefined);
  await client.file
    .delete(resolveNoteRuntimeDir(workspacePath, note.notebookId, note.entryId), { recursive: true })
    .catch(() => undefined);
  await client.box.session.persist(session.sessionId);
}
