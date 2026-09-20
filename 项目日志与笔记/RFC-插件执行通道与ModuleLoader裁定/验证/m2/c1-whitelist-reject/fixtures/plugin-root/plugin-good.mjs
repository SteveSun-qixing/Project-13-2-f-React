// 白名单内合规插件（阳性对照）：只引用插件作用域内模块，应成功求值并打点
import probe from './probe.mjs';
globalThis.__W0_GOOD_LOADED__ = probe;
console.log('[w0][good] plugin-good.mjs evaluated with', probe);
export default 'good';
