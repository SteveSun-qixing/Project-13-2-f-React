import bad from './bad-child.mjs';
globalThis.__PROBE_BAD_EVAL__ = true;
export default 'bad:' + bad;
