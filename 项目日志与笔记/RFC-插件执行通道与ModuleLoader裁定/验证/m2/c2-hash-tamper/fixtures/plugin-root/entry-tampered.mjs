// C2 被篡改入口（原始态）：main.cjs 会在装载前把磁盘内容改写为篡改版本，
// 注册表期望哈希仍是原始字节的摘要 → load 钩复算不合 → 拒装。
import probe from './probe.mjs';
globalThis.__W0_C2_TAMPERED_BODY_RAN__ = true;
export default 'tampered-original';
