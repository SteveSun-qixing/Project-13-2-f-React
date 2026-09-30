/**
 * 音乐基础卡片配置模型（《01-卡片文件格式》§6.8、《08-基础卡片插件接口》§7）。
 *
 * 配置位于节点内容 `config` 字段；本模块提供归一（readConfig）、派生展示信息
 * （deriveDisplayTitle / derivePrimaryArtist）、资源打开请求组装（buildMusicOpenRequest，
 * 《14-资源打开与默认处理器契约》§9.2 权威载荷形状），与
 * `assets/schemas/music-card-config.schema.json` 保持同一口径（08 §7.3：validateConfig
 * 不得比 schema 宽松）。
 */

import {
  inferAudioMimeType,
  isNonEmptyString,
  normalizeRelativeCardResourcePath,
  resolveFileName,
  stripFileExtension,
} from './shared/utils';

/** 卡片类型正式 ID（与 manifest capabilities.cardTypes[0].id 一致；历史别名 MusicCard 由平台归一）。 */
export const CARD_TYPE_ID = 'base.music';

/** 制作团队身份条目（《01》§6.8：id / role / people 三字段）。 */
export interface IMusicTeamRole {
  id: string;
  role: string;
  people: string[];
}

/** 音乐卡片配置。 */
export interface IMusicConfig {
  audio_file: string;
  music_name: string;
  album_cover: string;
  lyrics_file: string;
  production_team: IMusicTeamRole[];
  release_date: string;
  album_name: string;
  language: string;
  genre: string;
}

export const DEFAULT_CONFIG: IMusicConfig = {
  audio_file: '',
  music_name: '',
  album_cover: '',
  lyrics_file: '',
  production_team: [],
  release_date: '',
  album_name: '',
  language: '',
  genre: '',
};

const RELEASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ---------- 归一 ----------

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeResourcePath(value: unknown): string {
  return normalizeRelativeCardResourcePath(value) ?? '';
}

/**
 * 归一制作团队身份条目：角色与成员列表回退空值，空条目（无显式形状且无内容）剔除；
 * `id` 缺失时按位次补 `team-role-<n>`，保证条目标识稳定。
 */
function normalizeTeamRole(input: unknown, index: number): IMusicTeamRole | null {
  const record = input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const role = asString(record['role']);
  const people = Array.isArray(record['people'])
    ? record['people'].map((value) => asString(value)).filter((value) => value.length > 0)
    : [];

  const hasExplicitShape =
    typeof record['id'] === 'string' || 'role' in record || 'people' in record;

  if (!role && people.length === 0 && !hasExplicitShape) {
    return null;
  }

  return {
    id: asString(record['id']) || `team-role-${index + 1}`,
    role,
    people,
  };
}

/**
 * 归一任意输入为完整配置：缺失或非法字段回退默认值（08 §7.1 规则 2）。
 */
export function readConfig(input: unknown): IMusicConfig {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const productionTeam = Array.isArray(record['production_team'])
    ? record['production_team']
        .map((item, index) => normalizeTeamRole(item, index))
        .filter((item): item is IMusicTeamRole => item !== null)
    : [];

  return {
    audio_file: normalizeResourcePath(record['audio_file']),
    music_name: asString(record['music_name']),
    album_cover: normalizeResourcePath(record['album_cover']),
    lyrics_file: normalizeResourcePath(record['lyrics_file']),
    production_team: productionTeam,
    release_date: asString(record['release_date']),
    album_name: asString(record['album_name']),
    language: asString(record['language']),
    genre: asString(record['genre']),
  };
}

// ---------- 校验（与 schema 同口径：出现即校验，缺席不阻断） ----------

function isValidResourcePathField(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  if (value.trim().length === 0) {
    return true;
  }
  return normalizeRelativeCardResourcePath(value) !== undefined;
}

/**
 * 校验节点内容中的 config（08 §2.4.3）：纯函数；`undefined` / `null` 视为未提供配置，
 * 必须返回 `true`。非空资源路径字段必须是合法包内相对路径；非空 `release_date` 必须是
 * YYYY-MM-DD，比 schema（仅类型约束）更严，属于 §7.3 允许的业务补充校验。
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }
  const record = config as Record<string, unknown>;
  for (const key of ['audio_file', 'album_cover', 'lyrics_file'] as const) {
    if (!isValidResourcePathField(record[key])) {
      return false;
    }
  }
  for (const key of ['music_name', 'album_name', 'language', 'genre', 'release_date'] as const) {
    if (record[key] !== undefined && typeof record[key] !== 'string') {
      return false;
    }
  }
  const releaseDate = record['release_date'];
  if (typeof releaseDate === 'string' && releaseDate.trim().length > 0 && !RELEASE_DATE_PATTERN.test(releaseDate.trim())) {
    return false;
  }
  const productionTeam = record['production_team'];
  if (productionTeam !== undefined) {
    if (!Array.isArray(productionTeam)) {
      return false;
    }
    for (const item of productionTeam) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return false;
      }
      const roleRecord = item as Record<string, unknown>;
      for (const key of ['id', 'role'] as const) {
        if (roleRecord[key] !== undefined && typeof roleRecord[key] !== 'string') {
          return false;
        }
      }
      const people = roleRecord['people'];
      if (people !== undefined) {
        if (!Array.isArray(people) || people.some((person) => typeof person !== 'string')) {
          return false;
        }
      }
    }
  }
  return true;
}

// ---------- 内容组装 ----------

/**
 * 由配置组装节点内容（与 `createInitialContent` / 编辑器 replace 变更共用）。
 */
export function buildContent(config: IMusicConfig): Record<string, unknown> {
  return {
    card_type: CARD_TYPE_ID,
    config: { ...config },
  };
}

// ---------- 展示派生 ----------

/** 展示标题：歌曲名优先，其次音频文件名去扩展名。 */
export function deriveDisplayTitle(config: IMusicConfig): string {
  if (isNonEmptyString(config.music_name)) {
    return config.music_name.trim();
  }

  const audioFileName = resolveFileName(config.audio_file);
  if (audioFileName) {
    return stripFileExtension(audioFileName);
  }

  return '';
}

const SINGER_ROLE_KEYWORDS = [
  '歌手',
  '演唱',
  '主唱',
  'artist',
  'singer',
  'vocal',
  'vocals',
  'performer',
] as const;

function isSingerRole(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  return SINGER_ROLE_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

/** 展示歌手：优先歌手类身份的成员列表，否则首个含成员身份；无成员返回空串。 */
export function derivePrimaryArtist(config: IMusicConfig): string {
  const singerRole = config.production_team.find(
    (role) => isSingerRole(role.role) && role.people.length > 0,
  );
  if (singerRole) {
    return singerRole.people.join(' / ');
  }

  const firstRole = config.production_team.find((role) => role.people.length > 0);
  return firstRole ? firstRole.people.join(' / ') : '';
}

// ---------- 资源打开请求（《14》§9.2） ----------

/** 音乐卡片打开载荷的资源条目。 */
export interface IMusicOpenPayloadResource {
  /** 资源受管引用；取内容中的引用原样透传，插件不构造作用域（06-资源协议规范 §2.3）。 */
  readonly uri: string;
  /** 发起方视角相对路径；只用于日志与展示，不用于读取（14 §5）。 */
  readonly relativePath: string;
  readonly mimeType?: string;
}

/** 音乐卡片打开载荷（《14-资源打开与默认处理器契约》§9.2 权威形状）。 */
export interface IMusicOpenPayload {
  readonly kind: 'chips.music-card';
  readonly version: '1.0.0';
  readonly cardType: 'base.music';
  readonly resources: {
    readonly audio: IMusicOpenPayloadResource;
    readonly cover?: IMusicOpenPayloadResource;
    readonly lyrics?: IMusicOpenPayloadResource;
  };
  readonly display: {
    readonly title: string;
    readonly artist?: string;
  };
}

/** `resource:open` 能力输入（《14》§2.2）。 */
export interface IMusicOpenRequest {
  readonly intent: 'view';
  readonly resource: {
    readonly uri: string;
    readonly mimeType?: string;
    readonly fileName?: string;
    readonly title: string;
    readonly payload: IMusicOpenPayload;
  };
}

function buildPayloadResource(resourcePath: string): IMusicOpenPayloadResource | null {
  const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);
  if (!normalizedPath) {
    return null;
  }

  const mimeType = inferAudioMimeType(normalizedPath);
  return {
    uri: normalizedPath,
    relativePath: resolveFileName(normalizedPath),
    ...(mimeType === undefined ? {} : { mimeType }),
  };
}

/**
 * 组装音乐卡片打开请求：主资源为音频，封面与歌词随载荷投递；音频引用为空时返回 `null`。
 *
 * `uri` 一律取内容中的引用原样透传（解析器在进入渲染前已把包内相对引用归一为受管
 * 作用域 URI，渲染层只消费归一结果，不重复归一、不构造作用域——06 §2.6、§2.3）。
 */
export function buildMusicOpenRequest(config: IMusicConfig): IMusicOpenRequest | null {
  const audio = buildPayloadResource(config.audio_file);
  if (!audio) {
    return null;
  }

  const cover = buildPayloadResource(config.album_cover);
  const lyrics = buildPayloadResource(config.lyrics_file);
  const title = deriveDisplayTitle(config);
  const artist = derivePrimaryArtist(config);

  const payload: IMusicOpenPayload = {
    kind: 'chips.music-card',
    version: '1.0.0',
    cardType: CARD_TYPE_ID,
    resources: {
      audio,
      ...(cover === null ? {} : { cover }),
      ...(lyrics === null ? {} : { lyrics }),
    },
    display: {
      title,
      ...(artist.length === 0 ? {} : { artist }),
    },
  };

  return {
    intent: 'view',
    resource: {
      uri: audio.uri,
      ...(audio.mimeType === undefined ? {} : { mimeType: audio.mimeType }),
      fileName: audio.relativePath,
      title,
      payload,
    },
  };
}
