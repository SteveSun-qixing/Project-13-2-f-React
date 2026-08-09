export class AnimationEventShim extends Event {
  readonly animationName: string;
  readonly elapsedTime: number;
  readonly pseudoElement: string;

  constructor(type: string, init: { animationName?: string; elapsedTime?: number; pseudoElement?: string } = {}) {
    super(type);
    this.animationName = init.animationName ?? "";
    this.elapsedTime = init.elapsedTime ?? 0;
    this.pseudoElement = init.pseudoElement ?? "";
  }
}

(window as Window & { AnimationEvent?: typeof AnimationEventShim }).AnimationEvent = AnimationEventShim;
Object.defineProperty(CSSStyleDeclaration.prototype, "animation", {
  get: () => "",
  configurable: true,
});
