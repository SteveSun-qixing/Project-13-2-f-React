// 越界口径 a：插件体内 import node:* —— resolve 钩应真实抛拒，本文件体与 probe 均不得被求值
import './probe.mjs';
import { readFileSync } from 'node:fs';
globalThis.__W0_NODE_BODY_RAN__ = true;
export const viaNode = readFileSync;
