// 越界口径 b：插件体内 import electron —— resolve 钩应真实抛拒，本文件体与 probe 均不得被求值
import './probe.mjs';
import { app } from 'electron';
globalThis.__W0_ELECTRON_BODY_RAN__ = true;
export const electronApp = app;
