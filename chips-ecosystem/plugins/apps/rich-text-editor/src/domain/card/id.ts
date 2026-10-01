/**
 * 文件级标识文法（《05-ID生成规范》，薯片生态文档库/04-文件格式规范）。
 *
 * 权威口径（§二）：四类文件级标识（`card_id`、`box_id`、内容节点 ID、条目 `entry_id`）
 * 统一为 10 个字符、Base62 字符集（`0-9`、`a-z`、`A-Z`），文法 `^[0-9A-Za-z]{10}$`；
 * 大小写敏感，存储、序列化、比较与匹配全程按原样处理，禁止大小写归一化
 * （唯一例外是节点 ID 的文件系统等价查重，§二.6）。
 *
 * 生成职责边界（§四）：`card_id` / `box_id` 由文档服务（Rust 核心受控写口）生成，
 * 内容节点 ID / 条目 ID 由编辑链路生成；应用插件不得生成、复制或改写四类 ID，
 * 也不得拼装含 ID 的文档字节（§10.1）。因此本模块只承载**文法校验**与
 * **节点集合等价查重**，不提供任何生成面；旧仓 `generateId62` 生成面不迁移。
 */

/** 四类文件级标识共用的十位 Base62 文法（§二.1；与宿主 `MEMBER_ID_PATTERN`、内核 `is_base62_id` 同字面）。 */
export const CHIP_ID_PATTERN = /^[0-9A-Za-z]{10}$/;

/**
 * 校验标识是否符合十位 Base62 文法（§七.1：长度、字符集、大小写全部精确；
 * 拒绝空串、Unicode 相似字符与全 / 半角变体，不做修剪与归一化）。
 */
export function isValidChipId(value: unknown): value is string {
  return typeof value === 'string' && CHIP_ID_PATTERN.test(value);
}

/**
 * 节点集合大小写不敏感等价查重（§二.6、§六.1）：同一卡片内两个节点 ID 不得仅在
 * 字母大小写上不同（大小写不敏感文件系统上会映射为同一路径）。
 *
 * 仅用于查重判定；比较结果不改变任何标识的原样形态。
 */
export function hasCaseInsensitiveDuplicate(nodeIds: readonly string[]): boolean {
  const seen = new Set<string>();
  for (const nodeId of nodeIds) {
    const folded = nodeId.toLowerCase();
    if (seen.has(folded)) {
      return true;
    }
    seen.add(folded);
  }
  return false;
}
