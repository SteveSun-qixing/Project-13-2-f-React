// 波0 FLAGS：Electron 主进程下 --experimental-vm-modules 注入方式实测探针。
// 由不同启动命令（argv 前置/后置、NODE_OPTIONS、appendSwitch）反复调用，输出统一 JSON 证据行。
'use strict';
const { app } = require('electron');
const vm0 = require('node:vm');

// appendSwitch 探针：在主脚本最早期登记 Chromium 命令行开关，看其对 Node 引导期 flag 是否有影响
app.commandLine.appendSwitch('experimental-vm-modules');

function snap(vmMod) {
  return {
    svmType: typeof vmMod.SourceTextModule,
    moduleCtorType: typeof vmMod.Module,
  };
}

const boot = snap(vm0);

app.whenReady().then(() => {
  // 再取一次 vm（同一 builtin 命名空间），并动态 import vm 看 realm 级视图
  const vm1 = require('node:vm');
  const afterReady = snap(vm1);
  let directErr = null;
  try {
    new vm1.SourceTextModule('export default 1;');
  } catch (e) {
    directErr = String((e && e.message) || e);
  }
  const evidence = {
    harness: 'FLAGS',
    pid: process.pid,
    ppid: process.ppid,
    processType: process.type,
    argv: process.argv,
    execArgv: process.execArgv,
    NODE_OPTIONS: process.env.NODE_OPTIONS ?? null,
    argvHasFlag: process.argv.some((a) => a.includes('experimental-vm-modules')),
    appendSwitchCalled: true,
    boot,
    afterReady,
    directErr,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
  };
  console.log('[w0][flags] EVIDENCE ' + JSON.stringify(evidence));
  app.exit(0);
});

setTimeout(() => {
  console.error('[w0][flags] WATCHDOG exit');
  app.exit(2);
}, 25000);
