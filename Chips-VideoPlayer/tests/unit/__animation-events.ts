// jsdom 不提供 AnimationEvent/TransitionEvent，React 检测不到时会移除 animationend 等事件注册，
// 导致 onAnimationEnd 在测试环境中永不触发。本模块必须在 react-dom 加载之前生效。
if (!("AnimationEvent" in window)) {
  class AnimationEventPolyfill extends Event {
    animationName = "";
    elapsedTime = 0;
    pseudoElement = "";
  }
  Object.defineProperty(window, "AnimationEvent", { value: AnimationEventPolyfill, configurable: true });
}

Object.defineProperty(CSSStyleDeclaration.prototype, "animation", {
  get: () => "",
  configurable: true,
});
