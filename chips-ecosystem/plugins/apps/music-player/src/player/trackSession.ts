/**
 * 曲目会话装配（重写件：纯编排层）。
 *
 * 旧实现分散在 `AppRuntimeProvider.tsx:917`（判重写：旧 PlatformLaunchContext 与 Client
 * 单例耦合）。本件以纯函数承载「地址 → 播放会话」的装配语义：
 * - 来源归一：`createAudioSourceFromUri`（直接可播放地址 → `AudioSource`）；
 * - 嵌入元数据探测：`probeAudioMetadata`（可取字节的地址经 `fetch` 取字节后交
 *   `@chips/plugin-music` 公开导出 `parseEmbeddedAudioMetadata` 解析——W5 迁移复用红线，
 *   禁第二份标签解析拷贝；取不到字节时如实返回 null，不伪造元数据）；
 * - 伴生歌词：`fetchCompanionLyrics`（字节 → `decodeTextWithFallback` → `parseLyricsText`，
 *   与迁移件解析链同源）；
 * - 呈现合成：`buildTrackPresentation`（展示字段优先级：卡片展示段 > 嵌入标签 > 文件名；
 *   歌词优先级：伴生 > 嵌入 > 空文档；封面优先级：伴生地址 > 嵌入封面 > 默认）。
 *
 * `resource:open` audio 槽位端到端落波后，启动投递复用同一装配形状（工单060 关联面）。
 */

import { parseEmbeddedAudioMetadata, type EmbeddedArtwork, type EmbeddedAudioMetadata } from '@chips/plugin-music';
import {
  inferAudioMimeType,
  isDirectPlayableUri,
  resolveAudioFormatLabel,
  resolveExtension,
  resolveFileName,
  resolveTrackTitle,
  type AudioSource,
  type LaunchAudioTarget,
} from './musicPlayer';
import { decodeTextWithFallback, createEmptyLyricsDocument, parseLyricsText, type LyricsDocument } from './lyrics';

/** 曲目封面来源：默认占位 / 伴生地址 / 嵌入封面字节。 */
export type TrackArtwork =
  | { kind: 'default' }
  | { kind: 'companion'; uri: string }
  | { kind: 'embedded'; artwork: EmbeddedArtwork; cacheKey: string };

/** 曲目呈现：一次播放会话的完整展示与歌词上下文。 */
export interface TrackPresentation {
  source: AudioSource;
  title: string;
  artist: string;
  album: string;
  artwork: TrackArtwork;
  lyrics: LyricsDocument;
}

/** 空态地址装配输入。 */
export interface TrackAssemblyInput {
  /** 音频地址（必填，直接可播放）。 */
  audioUri: string;
  /** 展示标题（可选；缺省按文件名）。 */
  title?: string;
  /** 伴生歌词地址（可选）。 */
  lyricsUri?: string;
  /** 伴生封面地址（可选）。 */
  coverUri?: string;
}

/** 装配结果：成功携带曲目呈现，失败携带简体中文原因。 */
export type TrackAssemblyResult =
  | { ok: true; presentation: TrackPresentation }
  | { ok: false; error: string };

/** URI 段解码：`URL.pathname` 对非 ASCII 段做百分号编码，展示名按原文字还原；非法编码原样保留（vp 判例同口径）。 */
function decodeUriFileName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 由地址构造播放会话来源；不可播放地址返回 null。 */
export function createAudioSourceFromUri(uri: string): AudioSource | null {
  const normalized = uri.trim();
  if (!normalized || !isDirectPlayableUri(normalized)) {
    return null;
  }

  // data: 地址的路径段是载荷本身（非文件名），来源名按「数据音频」承载；
  // MIME 取 data URL 头部声明，展示名不得使用 base64 载荷。
  const isDataUri = normalized.startsWith('data:');
  const dataMime = isDataUri ? (/^data:([^;,]+)/u.exec(normalized)?.[1] ?? 'audio/mpeg') : undefined;
  const inferredMime = isDataUri ? dataMime : inferAudioMimeType(normalized);
  const target: LaunchAudioTarget = {
    sourceId: normalized,
    filePath: normalized,
    fileName: isDataUri ? 'audio-data' : decodeUriFileName(resolveFileName(normalized)),
    ...(inferredMime !== undefined ? { mimeType: inferredMime } : {}),
  };

  return {
    sourceId: target.sourceId,
    ...(target.filePath !== undefined ? { filePath: target.filePath } : {}),
    fileName: target.fileName || target.sourceId,
    title: resolveTrackTitle(target),
    resourceUri: normalized,
    ...(target.mimeType !== undefined ? { mimeType: target.mimeType } : {}),
    ...(resolveExtension(normalized) && !isDataUri ? { extension: resolveExtension(normalized) } : {}),
    revision: 1,
    isRemote: normalized.startsWith('http:') || normalized.startsWith('https:'),
  };
}

/** 音频地址装配守卫：返回简体中文错误文案表示不可加入队列。 */
export function validateAudioAssemblyInput(input: TrackAssemblyInput): string | undefined {
  if (!input.audioUri.trim()) {
    return '请输入音频地址。';
  }
  const source = createAudioSourceFromUri(input.audioUri);
  if (source === null) {
    return '暂不支持该地址形式：请使用 file://、http(s)://、blob: 或 data: 地址。';
  }
  for (const [label, uri] of [
    ['歌词', input.lyricsUri],
    ['封面', input.coverUri],
  ] as const) {
    const trimmed = uri?.trim() ?? '';
    if (trimmed && !isDirectPlayableUri(trimmed)) {
      return `${label}地址不可用：请使用 file://、http(s)://、blob: 或 data: 地址。`;
    }
  }
  return undefined;
}

/**
 * 探测音频嵌入元数据：可取字节的地址（data:/blob:/http(s)）经 fetch 取字节后交
 * `parseEmbeddedAudioMetadata`（`@chips/plugin-music` 公开导出）；`file:` 地址与网络失败
 * 如实返回 null（渲染会话无文件字节通道，`resource:read` 宿主处理器缺位，工单061 在册；
 * 端到端落波后改走资源句柄读取）。
 */
export async function probeAudioMetadata(source: AudioSource): Promise<EmbeddedAudioMetadata | null> {
  if (source.resourceUri.startsWith('file:')) {
    return null;
  }

  try {
    const response = await fetch(source.resourceUri);
    if (!response.ok) {
      return null;
    }
    const bytes = await response.arrayBuffer();
    return parseEmbeddedAudioMetadata({ bytes, fileName: source.fileName });
  } catch {
    return null;
  }
}

/**
 * 拉取伴生歌词文本：字节经 `decodeTextWithFallback` 多编码收口后交 `parseLyricsText`。
 * 拉取失败或非歌词内容（空文档）如实返回 null，由调用方按「无歌词」呈现。
 */
export async function fetchCompanionLyrics(uri: string): Promise<LyricsDocument | null> {
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      return null;
    }
    const bytes = await response.arrayBuffer();
    const document = parseLyricsText(decodeTextWithFallback(bytes), 'companion');
    return document.mode === 'empty' ? null : document;
  } catch {
    return null;
  }
}

function resolveEmbeddedLyrics(metadata: EmbeddedAudioMetadata | null): LyricsDocument | null {
  const timed = metadata?.timedLyricsText?.trim();
  if (timed) {
    return parseLyricsText(timed, 'embedded');
  }
  const plain = metadata?.lyricsText?.trim();
  if (plain) {
    return parseLyricsText(plain, 'embedded');
  }
  return null;
}

/** 呈现合成：展示字段与歌词/封面的优先级裁决（见文件头）。 */
export function buildTrackPresentation(input: {
  source: AudioSource;
  metadata?: EmbeddedAudioMetadata | null;
  companionLyrics?: LyricsDocument | null;
  companionCoverUri?: string;
  cardDisplay?: { title?: string; artist?: string };
}): TrackPresentation {
  const { source } = input;
  const metadata = input.metadata ?? null;

  const title = input.cardDisplay?.title?.trim() || source.title || source.fileName;
  const artist = input.cardDisplay?.artist?.trim() || metadata?.artist?.trim() || '';
  const album = metadata?.album?.trim() || '';

  const lyrics =
    input.companionLyrics && input.companionLyrics.mode !== 'empty'
      ? input.companionLyrics
      : (resolveEmbeddedLyrics(metadata) ?? createEmptyLyricsDocument('none'));

  const coverUri = input.companionCoverUri?.trim();
  const embedded = metadata?.artwork;
  const artwork: TrackArtwork =
    coverUri && coverUri.length > 0
      ? { kind: 'companion', uri: coverUri }
      : embedded && embedded.bytes.length > 0
        ? { kind: 'embedded', artwork: embedded, cacheKey: `${source.sourceId}#${source.revision}` }
        : { kind: 'default' };

  return {
    source,
    title,
    artist,
    album,
    artwork,
    lyrics,
  };
}

/** 空态地址装配：守卫 → 来源归一（元数据与伴生资源由调用方异步补全）。 */
export function assembleTrackFromInput(input: TrackAssemblyInput): TrackAssemblyResult {
  const invalidReason = validateAudioAssemblyInput(input);
  if (invalidReason !== undefined) {
    return { ok: false, error: invalidReason };
  }

  const source = createAudioSourceFromUri(input.audioUri);
  if (source === null) {
    return { ok: false, error: '无法识别的音频地址。' };
  }

  const presentation = buildTrackPresentation({
    source,
    ...(input.title !== undefined || input.coverUri !== undefined
      ? {
          cardDisplay: {
            ...(input.title !== undefined ? { title: input.title } : {}),
          },
        }
      : {}),
    ...(input.coverUri?.trim() ? { companionCoverUri: input.coverUri.trim() } : {}),
  });
  return { ok: true, presentation };
}

/** 曲目格式徽标文案（扩展名优先，缺省按 MIME 子类型）。 */
export function resolveTrackFormatLabel(presentation: TrackPresentation): string {
  return resolveAudioFormatLabel(presentation.source.resourceUri, presentation.source.mimeType);
}
