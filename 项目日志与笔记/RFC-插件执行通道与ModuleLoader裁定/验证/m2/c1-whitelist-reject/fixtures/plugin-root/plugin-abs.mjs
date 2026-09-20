// 越界口径 c：插件体内 import 作用域外绝对路径 —— resolve 钩应真实抛拒，probe 不得被求值
import './probe.mjs';
import outside from '../outside-scope/probe-outside.mjs';
globalThis.__W0_ABS_BODY_RAN__ = true;
export const outsideMarker = outside;
