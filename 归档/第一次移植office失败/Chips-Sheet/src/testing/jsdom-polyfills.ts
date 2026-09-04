/**
 * jsdom 测试环境补丁（仅测试使用）。
 *
 * jsdom 未实现 Canvas 的 Path2D API，而 Univer 部分开源 preset 包在模块加载期
 * 就会引用它。DOM 测试在导入应用代码前先执行本文件，补齐一个仅用于
 * 模块求值的最小存根（测试不会真正渲染 Univer 画布）。
 */
const globalScope = globalThis as unknown as Record<string, unknown>;

if (!globalScope.Path2D) {
  globalScope.Path2D = class Path2DStub {
    addPath(): void {}
    closePath(): void {}
    moveTo(): void {}
    lineTo(): void {}
    bezierCurveTo(): void {}
    quadraticCurveTo(): void {}
    arc(): void {}
    arcTo(): void {}
    ellipse(): void {}
    rect(): void {}
  };
}

export {};
