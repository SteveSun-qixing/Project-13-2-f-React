/**
 * 客户端渲染产物记录模型（《个人服务器设计》§4.5 产物记录模型）。
 *
 * 写入方＝card-transfer 控制面臂的 complete 发布事务（上传会话校验通过后落库到
 * cards.render_artifacts）；本臂（内容只读域）只做读侧消费：查看/封面入口重定向
 * 与产物可用性判定，读侧仅信任 entryUrl 与存在性，完整结构校验由写入事务负责。
 */

/** 单份渲染产物（查看或封面）的对象位置与统计 */
export interface RenderArtifactRecord {
  /** 产物目录版本标识（＝上传会话 ID，§4.3；受控代理路由校验用） */
  cacheVersion: string;
  bucket: string;
  keyPrefix: string;
  entryObjectKey: string;
  /** 产物入口：公开产物为对象存储 URL，私密产物为受控代理路由 */
  entryUrl: string;
  fileCount: number;
  sizeBytes: number;
}

/** 一张卡片完整的客户端渲染产物清单（cards.render_artifacts 落库形态） */
export interface CardRenderArtifacts {
  rendererVersion: string;
  view: RenderArtifactRecord;
  cover?: RenderArtifactRecord;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readEntryUrl(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const entryUrl = value['entryUrl'];
  return typeof entryUrl === 'string' && entryUrl.length > 0 ? entryUrl : null;
}

/**
 * 从 jsonb 读取渲染产物清单；不存在或缺少查看产物入口时返回 null
 * （公开面以 hasRenderArtifacts / CARD_RENDER_NOT_READY 表达「尚未渲染」）。
 */
export function readRenderArtifacts(value: unknown): CardRenderArtifacts | null {
  if (!isRecord(value)) {
    return null;
  }
  const viewEntryUrl = readEntryUrl(value['view']);
  if (viewEntryUrl === null) {
    return null;
  }
  const coverEntryUrl = readEntryUrl(value['cover']);
  return {
    rendererVersion: typeof value['rendererVersion'] === 'string' ? value['rendererVersion'] : '',
    view: { ...(value['view'] as RenderArtifactRecord), entryUrl: viewEntryUrl },
    ...(coverEntryUrl !== null
      ? { cover: { ...(value['cover'] as RenderArtifactRecord), entryUrl: coverEntryUrl } }
      : {}),
  };
}
