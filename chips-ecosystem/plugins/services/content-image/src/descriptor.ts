/**
 * 图像内容处理服务（canonical 包 `chips.service.content-image`）：
 * 登记标识、描述符与限额常量。
 *
 * 标识三元组逐列取 04-能力契约规范 §8.4 canonical 登记表的在册值（一经登记即稳定，
 * §8.7 不得重命名）：能力 ID `content-image.pick-colors`、服务名 `content-image`、
 * 提供方 `chips.service.content-image`。本包是图像族三能力的唯一提供方，
 * 服务名即族名（§8.2「每个能力 ID 绑定唯一服务名与唯一提供方插件」）；
 * `normalize` / `transcode` 两能力的契约面已随包先行发布（`assets/schemas/`），
 * 实现缺位 ⇒ 不注册描述符、不声明操作、不进服务面（W4 §9.1 并行闸 3「禁假接线」）。
 */

import type { IContentCapabilityDescriptor } from './types.js';

/** 内容处理能力 ID（04-能力契约规范 §8.4 登记项）。 */
export const CONTENT_CAPABILITY_ID = 'content-image.pick-colors';

/** 本插件注册的 Cordis 服务名（§8.2 文法）。 */
export const CORDIS_SERVICE_NAME = 'content-image';

/** 提供方插件 ID。 */
export const PROVIDER_PLUGIN_ID = 'chips.service.content-image';

/** 原子操作名（§8.4 登记：`pickColors`）。 */
export const PICK_COLORS_OPERATION = 'pickColors';

/** 输入上限：图像字节 64 MiB（超出按 `IMAGE_INPUT_UNSUPPORTED` 收口）。 */
export const MAX_IMAGE_BYTES = 64 * 1024 * 1024;

/** 采样边长缺省值（像素）。 */
export const DEFAULT_SAMPLE_SIZE = 96;

/** 采样边长下界（像素）。 */
export const MIN_SAMPLE_SIZE = 48;

/** 采样边长上界（像素）。 */
export const MAX_SAMPLE_SIZE = 160;

/** 解码样本 LRU 上限（旧模块 `SAMPLE_CACHE_LIMIT` 同值）。 */
export const SAMPLE_CACHE_LIMIT = 24;

/** 取色结果 LRU 上限（旧模块 `RESULT_CACHE_LIMIT` 同值）。 */
export const RESULT_CACHE_LIMIT = 48;

/** 并发取色闸门（旧模块 `MAX_ACTIVE_PICK_TASKS` 同值）。 */
export const MAX_ACTIVE_PICK_TASKS = 2;

/** 来源标识长度上限（缓存键用，防止无界键）。 */
export const MAX_SOURCE_KEY_LENGTH = 512;

/**
 * 提供方契约描述符（`assets/schemas/descriptor.json` 同源）。
 *
 * `sourceFormats` 为空是事实登记：图像字节 → RGBA 像素的解码供给未在册
 * （见 `pixel-source.ts`），本包不承诺任何未经证实的格式支持矩阵；
 * 解码提供方接入后由该波次回写格式集。
 */
export const pickColorsCapabilityDescriptor: IContentCapabilityDescriptor = {
  id: CONTENT_CAPABILITY_ID,
  service: CORDIS_SERVICE_NAME,
  provider: PROVIDER_PLUGIN_ID,
  operations: [PICK_COLORS_OPERATION],
  sourceFormats: [],
  targetFormats: ['color-palette-json'],
  streaming: { input: false, output: false },
  maxInlineInputBytes: MAX_IMAGE_BYTES,
  contractPackage: `${PROVIDER_PLUGIN_ID}/assets/schemas`,
};
