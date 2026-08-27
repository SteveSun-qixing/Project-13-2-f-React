/**
 * MinIO / S3 兼容对象存储的 Bucket 名称常量。
 *
 * 命名规则：全小写，连字符分隔（S3 规范）
 * 路径规则：
 *   chips-card-resources/cards/{cardId}/versions/{versionId}/...
 *   chips-box-files/boxes/{boxId}/versions/{versionId}/box.box
 *   chips-card-render-cache/{cardId}/{cacheVersion}/index.html
 *   chips-card-render-cache-private/{cardId}/{cacheVersion}/index.html
 *   chips-card-cover-cache/{cardId}/{cacheVersion}/index.html
 *   chips-card-cover-cache-private/{cardId}/{cacheVersion}/index.html
 *   chips-covers/boxes/{boxId}/cover/index.html
 */
export const Bucket = {
  /** 卡片内嵌资源与网络资源卡片对象，公开读 */
  CARD_RESOURCES: 'chips-card-resources',

  /** 发布态 .box 源文件，内部读 */
  BOX_FILES: 'chips-box-files',

  /** 公开卡片的查看渲染产物（客户端渲染上传），公开读 */
  CARD_RENDER_CACHE: 'chips-card-render-cache',

  /** 私有卡片的查看渲染产物，内部读，由 API 受控代理 */
  CARD_RENDER_CACHE_PRIVATE: 'chips-card-render-cache-private',

  /** 公开卡片封面产物（客户端渲染上传），公开读 */
  CARD_COVER_CACHE: 'chips-card-cover-cache',

  /** 私有卡片封面产物，内部读，由 API 受控代理 */
  CARD_COVER_CACHE_PRIVATE: 'chips-card-cover-cache-private',

  /** 箱子封面等非卡片封面资源，公开读 */
  COVERS: 'chips-covers',
} as const;

export type BucketName = (typeof Bucket)[keyof typeof Bucket];
export type PublicBucketName = Exclude<
  BucketName,
  typeof Bucket.CARD_RENDER_CACHE_PRIVATE
    | typeof Bucket.CARD_COVER_CACHE_PRIVATE
    | typeof Bucket.BOX_FILES
>;

/** 需要公开访问的 bucket 列表 */
export const PUBLIC_BUCKETS: PublicBucketName[] = [
  Bucket.CARD_RESOURCES,
  Bucket.CARD_RENDER_CACHE,
  Bucket.CARD_COVER_CACHE,
  Bucket.COVERS,
];

/** 只供服务端内部访问的 bucket 列表 */
export const PRIVATE_BUCKETS: BucketName[] = [
  Bucket.BOX_FILES,
  Bucket.CARD_RENDER_CACHE_PRIVATE,
  Bucket.CARD_COVER_CACHE_PRIVATE,
];

/** 所有需要在启动时创建的 bucket 列表 */
export const STORAGE_BUCKETS: BucketName[] = [...PUBLIC_BUCKETS, ...PRIVATE_BUCKETS];
