// 波0 M2-C1 探针模块：被求值即在 globalThis 打点（证明“插件体代码是否被执行”）
globalThis.__W0_PROBE_EVALUATED__ = true;
console.log('[w0][probe] probe.mjs EVALUATED (marker set)');
export default 'probe';
