// 作用域外探针：被求值即打点（用于断言“越界绝对路径目标从未被 import 求值”）
globalThis.__W0_OUTSIDE_PROBE_EVALUATED__ = true;
console.log('[w0][probe-outside] OUTSIDE-Scope probe EVALUATED (MUST NOT HAPPEN)');
export default 'outside-probe';
