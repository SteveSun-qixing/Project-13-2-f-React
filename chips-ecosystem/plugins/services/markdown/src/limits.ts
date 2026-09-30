/**
 * 服务输入上限（纯常量模块，无副作用）。
 *
 * 上限是服务自身的资源保护面：超出即按 `BRIDGE_INVALID_INPUT` 收口，
 * 与消费方（富文本卡片的内联阈值 `MAX_INLINE_RICHTEXT_LENGTH`）分属两层——
 * 消费方阈值决定「存哪」，本上限决定「服务单次最多吃多少」。
 */

/** 单次调用接受的 Markdown 源文最大字符数（约 1 MiB 文本量级）。 */
export const MAX_MARKDOWN_INPUT_LENGTH = 1_000_000;
