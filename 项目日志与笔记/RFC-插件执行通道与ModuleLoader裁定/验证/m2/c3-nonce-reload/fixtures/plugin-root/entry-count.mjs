// C3 复加载探针入口：模块体每被求值一次，计数 +1（区分“缓存遮蔽”与“真实复执行”）
globalThis.__W0_C3_EXEC_COUNT__ = (globalThis.__W0_C3_EXEC_COUNT__ ?? 0) + 1;
console.log('[w0][c3] entry-count.mjs EVALUATED, execCount=' + globalThis.__W0_C3_EXEC_COUNT__);
export default 'exec-' + globalThis.__W0_C3_EXEC_COUNT__;
