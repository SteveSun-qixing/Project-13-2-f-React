// E1 沙箱渲染侧 preload：采集 renderer 边界证据（宿主安全基线 sandbox:true / nodeIntegration:false / contextIsolation:true）
const probe = {
  hasProcess: typeof process !== 'undefined',
  processType: typeof process !== 'undefined' ? process.type : null,
  hasRequireGlobal: typeof require === 'function',
  canRequireElectron: false,
  canRequireNodeFs: false,
  hasModuleGlobal: typeof module !== 'undefined',
};
try {
  const e = require('electron');
  probe.canRequireElectron = !!(e && e.ipcRenderer);
} catch {
  /* sandbox 下受限属预期 */
}
try {
  require('node:fs');
  probe.canRequireNodeFs = true;
} catch {
  probe.canRequireNodeFs = false;
}
try {
  const { ipcRenderer } = require('electron');
  ipcRenderer.send('w0-preload-evidence', probe);
} catch (e) {
  console.error('[w0][e1] preload send failed: ' + (e && e.message));
}
