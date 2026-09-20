// 越界口径 d：插件体内裸路径 builtin `fs`（非 node: 前缀裸 specifier）—— 同应被 resolve 钩抛拒
import './probe.mjs';
import { readFileSync } from 'fs';
globalThis.__W0_BARE_BODY_RAN__ = true;
export const viaBare = readFileSync;
