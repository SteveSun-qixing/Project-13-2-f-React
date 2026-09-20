// C2 合规入口（阳性对照）：字节与安装期登记哈希一致，应通过 load 门禁
import probe from './probe.mjs';
globalThis.__W0_C2_CLEAN_LOADED__ = probe;
export default 'clean';
