/**
 * 文件转换编排服务：登记描述符与常量。
 *
 * 链路腿与编排能力 ID 均为 04-能力契约规范 §8.4 登记的 canonical 值（一经登记即稳定）：
 * 编排角色 `content-file-conversion.convert` 已按《RFC-file-processing转换编排域命名裁定》
 * （用户裁决 B1 案，2026-10-01）入册 §8.4 正表，描述符随包发布
 * （`contracts/descriptor.json`，对齐 cardtohtml 八字段判例）；旧 `converter.file.convert`
 * 维持不登记，处置行记「已替代」。
 */

/** 提供方插件 ID（09-官方插件与应用目录 §6.1/§6.2）。 */
export const FILE_CONVERSION_PLUGIN_ID = 'chips.service.file-conversion';

/** 编排能力 ID（§8.4 登记项，RFC 裁定 B1 案转正）。 */
export const FILE_CONVERSION_CAPABILITY_ID = 'content-file-conversion.convert';

/** 本插件注册的 Cordis 服务名（内核服务文法 `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`）。 */
export const FILE_CONVERSION_SERVICE_NAME = 'content-file-conversion';

/** 链路腿：content-converter.card-to-html（§8.4 登记项）。 */
export const CARD_TO_HTML_CAPABILITY_ID = 'content-converter.card-to-html';
/** 链路腿：content-converter.html-to-pdf（§8.4 登记项）。 */
export const HTML_TO_PDF_CAPABILITY_ID = 'content-converter.html-to-pdf';
/** 链路腿：content-converter.html-to-image（§8.4 登记项）。 */
export const HTML_TO_IMAGE_CAPABILITY_ID = 'content-converter.html-to-image';

/** 链路腿提供方 Cordis 服务名（消费方经 ctx.inject 以服务名注入）。 */
export const CARD_CONVERTER_SERVICE_NAME = 'content-converter';
export const HTML_TO_PDF_SERVICE_NAME = 'content-html-to-pdf';
export const HTML_TO_IMAGE_SERVICE_NAME = 'content-html-to-image';

/** 中间 HTML 暂存根前缀（旧算法语义逐字迁移：card→pdf/image 两腿链路）。 */
export const STAGING_HTML_ROOT_PREFIX = '.chips-file-conversion-';
/** 产物暂存根前缀（旧算法语义逐字迁移：目标为最终产物形态的单腿链路）。 */
export const STAGING_OUTPUT_ROOT_PREFIX = '.chips-file-conversion-output-';

/** 目录态 HTML 产物缺省入口文件（content-converter 目录态契约入口名）。 */
export const HTML_ENTRY_FILE = 'index.html';
