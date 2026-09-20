import ok from './child.mjs';
globalThis.__PROBE_ENTRY_EVAL__ = (globalThis.__PROBE_ENTRY_EVAL__ ?? 0) + 1;
export default 'entry:' + ok;
