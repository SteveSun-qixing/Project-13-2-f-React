/**
 * MinIO / S3 兼容对象存储的 Bucket 名称常量。
 *
 * 命名规则：全小写，连字符分隔（S3 规范）
 * 路径规则：
 *   chips-card-resources/{userId}/{cardId}/{filename}
 *   chips-card-files/{userId}/{cardId}/source.card
 *   chips-box-files/{userId}/{boxId}/source.box
 *   chips-card-render-cache/{cardId}/{cacheVersion}/index.html
 *   chips-card-render-cache-private/{cardId}/{cacheVersion}/index.html
 *   chips-card-cover-cache/{cardId}/{cacheVersion}/index.html
 *   chips-card-cover-cache-private/{cardId}/{cacheVersion}/index.html
 *   chips-avatars/{userId}/avatar.{ext}
 *   chips-covers/rooms/{roomId}/cover.{ext}
 */
export const Bucket = {
  /** 卡片内嵌资源文件（图片、视频、音频等），公开读 */
  CARD_RESOURCES: 'chips-card-resources',

  /** 发布态 .card 源文件，内部读 */
  CARD_FILES: 'chips-card-files',

  /** 发布态 .box 源文件，内部读 */
  BOX_FILES: 'chips-box-files',

  /** 公开卡片的渲染缓存，公开读 */
  CARD_RENDER_CACHE: 'chips-card-render-cache',

  /** 私有卡片的渲染缓存，内部读，由社区 API 受控代理 */
  CARD_RENDER_CACHE_PRIVATE: 'chips-card-render-cache-private',

  /** 公开卡片封面缓存，公开读 */
  CARD_COVER_CACHE: 'chips-card-cover-cache',

  /** 私有卡片封面缓存，内部读，由社区 API 受控代理 */
  CARD_COVER_CACHE_PRIVATE: 'chips-card-cover-cache-private',

  /** 用户头像，公开读 */
  AVATARS: 'chips-avatars',

  /** 房间/箱子等非卡片缓存封面资源，公开读 */
  COVERS: 'chips-covers',
} as const;

export type BucketName = (typeof Bucket)[keyof typeof Bucket];
export type PublicBucketName = Exclude<
  BucketName,
  typeof Bucket.CARD_FILES
    | typeof Bucket.CARD_RENDER_CACHE_PRIVATE
    | typeof Bucket.CARD_COVER_CACHE_PRIVATE
    | typeof Bucket.BOX_FILES
>;

/** 需要公开访问的 bucket 列表 */
export const PUBLIC_BUCKETS: PublicBucketName[] = [
  Bucket.CARD_RESOURCES,
  Bucket.CARD_RENDER_CACHE,
  Bucket.CARD_COVER_CACHE,
  Bucket.AVATARS,
  Bucket.COVERS,
];

/** 只供服务端/worker 内部访问的 bucket 列表 */
export const PRIVATE_BUCKETS: BucketName[] = [
  Bucket.CARD_FILES,
  Bucket.BOX_FILES,
  Bucket.CARD_RENDER_CACHE_PRIVATE,
  Bucket.CARD_COVER_CACHE_PRIVATE,
];

/** 所有需要在启动时创建的 bucket 列表 */
export const STORAGE_BUCKETS: BucketName[] = [...PUBLIC_BUCKETS, ...PRIVATE_BUCKETS];
