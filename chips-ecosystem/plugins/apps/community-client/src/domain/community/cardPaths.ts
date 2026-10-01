/**
 * 卡片归一路径面（《16-卡片传输协议》§4.2 资源枚举与引用判定的纯函数化）。
 *
 * 迁移自旧 `Chips-ModulePlugin/Chips-CommunityUploader-Plugin` 的
 * `card-rewrite.ts` / `publisher.ts` 路径归一素材（矩阵裁决：CommunityUploader 不单列插件，
 * publisher/card-rewrite 作为实现材料由卡片传输协议 + 本客户端承载）；按协议权威逐条对齐：
 * - 相对路径规范化：`/` 分隔、NFC、无 `..`、无前导 `/`（§4.2 第 1 条）；
 * - 结构性文件不进入资源对象：`.card/metadata.yaml`、`.card/structure.yaml`、
 *   `.card/cover.html`、`content/*.yaml`（§4.2 第 2 条）；
 * - 系统生成物排除：`__MACOSX/`、`.DS_Store`、`Thumbs.db`、`desktop.ini` 及隐藏条目
 *   （§4.2 第 3 条；`.card/cardcover/*` 按 §4.2 第 4 条仍按资源处理，仅按末段文件名判隐藏）；
 * - 资源相对路径包内必须唯一，重复即归档非法（§4.2 第 5 条，`CARD_TRANSFER_INVALID_INPUT`）；
 * - 引用判定：外部引用（`scheme:`、`//`、`#` 前缀）不改写；`?query` / `#fragment` 后缀
 *   分离保留；候选路径为「卡片根相对」与「引用所在文件目录相对」两条（§4.2 引用判定）。
 *
 * 本模块为纯函数：不做字节读取、不接触真实文件系统、不依赖 Node 内建模块（渲染上下文可用）。
 */

/** 结构性文件集合（§4.2 第 2 条；结构文件不参与资源枚举与改写）。 */
const STRUCTURAL_CARD_FILES: ReadonlySet<string> = new Set([
  '.card/metadata.yaml',
  '.card/structure.yaml',
  '.card/cover.html',
]);

/** 结构性内容配置目录前缀（`content/*.yaml` 全部为结构文件）。 */
const CONTENT_CONFIG_DIR = 'content/';

/** 系统生成物文件名集合（§4.2 第 3 条点名项）。 */
const SYSTEM_ARTIFACT_FILE_NAMES: ReadonlySet<string> = new Set([
  '.ds_store',
  'thumbs.db',
  'desktop.ini',
]);

/** macOS 归档生成物目录段（§4.2 第 3 条点名项）。 */
const SYSTEM_ARTIFACT_SEGMENT = '__macosx';

/** 卡片包内相对路径：全部为 `/` 分隔、NFC、无 `..`、无前导 `/` 的规范化形态。 */
export type CardRelativePath = string;

function collapseDots(segments: readonly string[]): string[] | null {
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      // 越过包根的相对路径非法（§4.2 第 1 条：规范化后无 `..`），整体拒绝。
      if (resolved.length === 0) {
        return null;
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }
  return resolved;
}

/**
 * 规范化卡片包内相对路径（§4.2 第 1 条）：反斜杠归一、NFC、折叠 `.`/`..` 与重复分隔符、
 * 去除前导与尾部分隔符。绝对路径、越过包根（`..` 溢出）与规范化后为空的路径返回 `null`。
 */
export function normalizeCardPath(value: string): CardRelativePath | null {
  const unified = value.normalize('NFC').replace(/\\/g, '/');
  const segments = collapseDots(unified.split('/'));
  if (segments === null || segments.length === 0) {
    return null;
  }
  return segments.join('/');
}

/** 判定路径是否为结构性文件（§4.2 第 2 条：结构文件与 `content/*.yaml` 均不进入资源对象）。 */
export function isStructuralCardFile(relativePath: CardRelativePath): boolean {
  if (STRUCTURAL_CARD_FILES.has(relativePath)) {
    return true;
  }
  return relativePath.startsWith(CONTENT_CONFIG_DIR) && relativePath.endsWith('.yaml');
}

/** 判定路径是否为系统生成物（§4.2 第 3 条；隐藏判定只看末段文件名，`.card/` 子树不受影响）。 */
export function isSystemArtifactFile(relativePath: CardRelativePath): boolean {
  const segments = relativePath.split('/');
  if (segments.some((segment) => segment.toLowerCase() === SYSTEM_ARTIFACT_SEGMENT)) {
    return true;
  }
  const fileName = segments[segments.length - 1];
  if (fileName === undefined) {
    return false;
  }
  if (fileName.startsWith('.')) {
    return true;
  }
  return SYSTEM_ARTIFACT_FILE_NAMES.has(fileName.toLowerCase());
}

/** 解包卡片目录内的一条文件条目（来自归档枚举或目录列举，调用方保证真实来源）。 */
export interface CardEntryInput {
  /** 归档内路径（未规范化；允许 `\`、冗余分隔符与 `.`/`..` 段）。 */
  readonly path: string;
  readonly isDirectory: boolean;
}

/** 规范化后的资源候选条目（§4.2 第 4 条：其余文件全部作为资源对象）。 */
export interface CardResourceEntry {
  readonly relativePath: CardRelativePath;
}

/**
 * 资源枚举（§4.2 第 1–4 条）：排除目录条目、结构性文件与系统生成物，
 * 其余文件按规范化相对路径升序返回（稳定顺序供上传编排与测试断言）。
 */
export function selectCardResourceEntries(entries: readonly CardEntryInput[]): CardResourceEntry[] {
  const resources: CardResourceEntry[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      continue;
    }
    const relativePath = normalizeCardPath(entry.path);
    if (relativePath === null) {
      continue;
    }
    if (isStructuralCardFile(relativePath) || isSystemArtifactFile(relativePath)) {
      continue;
    }
    resources.push({ relativePath });
  }
  return resources.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en'));
}

/** 重复资源路径清单（§4.2 第 5 条：资源相对路径包内必须唯一；返回去重后的重复路径集合）。 */
export function findDuplicateResourcePaths(
  entries: readonly CardResourceEntry[],
): readonly CardRelativePath[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.relativePath)) {
      duplicated.add(entry.relativePath);
    }
    seen.add(entry.relativePath);
  }
  return [...duplicated].sort((left, right) => left.localeCompare(right, 'en'));
}

/** 外部引用判定（§4.2 引用判定）：`scheme:`、`//`、`#` 前缀的值一律视为外部引用不改写。 */
export function isExternalReference(value: string): boolean {
  return /^(?:[a-z][a-z0-9+\-.]*:|\/\/|#)/i.test(value);
}

/** 引用后缀分离结果：`?query` / `#fragment` 与路径分离，改写或还原后原样拼回。 */
export interface ReferenceSplit {
  /** 不含后缀的引用路径。 */
  readonly path: string;
  /** 自首个 `?` 或 `#` 起的后缀原文（可能为空串）。 */
  readonly suffix: string;
}

/** 分离引用后缀（§4.2 引用判定：后缀保留，原样拼回）。 */
export function splitReferenceSuffix(value: string): ReferenceSplit {
  const match = /[?#]/.exec(value);
  if (match === null || match.index < 0) {
    return { path: value, suffix: '' };
  }
  return { path: value.slice(0, match.index), suffix: value.slice(match.index) };
}

/**
 * 包内引用候选路径解析（§4.2 引用判定）：依次尝试
 * 1. 规范化后的卡片根相对路径；2. 相对引用所在文件目录的路径。
 * 外部引用与越过包根的引用不产生候选；结果保持去重与先后次序。
 * 相对引用落点越过其所在目录但仍在包内时按解析结果收录（POSIX 路径语义）。
 */
export function resolveCardResourceCandidates(
  referencePath: string,
  sourceFilePath: CardRelativePath,
): readonly CardRelativePath[] {
  const trimmed = referencePath.trim();
  if (trimmed.length === 0) {
    return [];
  }
  if (isExternalReference(trimmed)) {
    return [];
  }

  const referenceSegments = trimmed.replace(/\\/g, '/').split('/');
  const candidates: string[] = [];

  const asRoot = collapseDots(referenceSegments);
  if (asRoot !== null && asRoot.length > 0) {
    candidates.push(asRoot.join('/'));
  }

  if (!trimmed.startsWith('/')) {
    const sourceDir = (normalizeCardPath(sourceFilePath) ?? sourceFilePath).split('/').slice(0, -1);
    const relativeToSource = collapseDots([...sourceDir, ...referenceSegments]);
    if (relativeToSource !== null && relativeToSource.length > 0) {
      candidates.push(relativeToSource.join('/'));
    }
  }

  return [...new Set(candidates)];
}
