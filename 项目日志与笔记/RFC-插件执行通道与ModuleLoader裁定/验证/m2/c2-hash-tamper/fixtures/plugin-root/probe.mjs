// C2 探针模块：被求值即打点（用于断言篡改包无半执行状态）
globalThis.__W0_C2_PROBE_EVALUATED__ = true;
console.log('[w0][c2] probe.mjs EVALUATED');
export default 'probe';
