import type { PointerInfo, Point } from "../types";
import type { PhotoEngine } from "../photo-engine";

const EDITABLE_TAGS = new Set(["input", "textarea", "select"]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return EDITABLE_TAGS.has(target.tagName.toLowerCase());
}

function hasOpenDialog(): boolean {
  return document.querySelector(".ant-modal-wrap") !== null;
}

export class PointerManager {
  private spaceDown = false;
  private panning = false;
  private panStart: Point = { x: 0, y: 0 };
  private panOrigin: Point = { x: 0, y: 0 };
  private pointerDown = false;
  private lastEvent: { clientX: number; clientY: number; time: number } | null = null;
  private speedAverage = 0;
  private lastMoveRaf = 0;
  private pendingMove: PointerEvent | null = null;
  private detachFns: Array<() => void> = [];

  constructor(private readonly engine: PhotoEngine) {}

  attach(stage: HTMLElement): void {
    stage.style.touchAction = "none";
    stage.addEventListener("pointerdown", this.onPointerDown);
    stage.addEventListener("pointermove", this.onPointerMove);
    stage.addEventListener("pointerup", this.onPointerUp);
    stage.addEventListener("pointercancel", this.onPointerUp);
    stage.addEventListener("pointerleave", this.onPointerLeave);
    stage.addEventListener("wheel", this.onWheel, { passive: false });
    stage.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);

    this.detachFns = [
      () => stage.removeEventListener("pointerdown", this.onPointerDown),
      () => stage.removeEventListener("pointermove", this.onPointerMove),
      () => stage.removeEventListener("pointerup", this.onPointerUp),
      () => stage.removeEventListener("pointercancel", this.onPointerUp),
      () => stage.removeEventListener("pointerleave", this.onPointerLeave),
      () => stage.removeEventListener("wheel", this.onWheel),
      () => stage.removeEventListener("contextmenu", this.onContextMenu),
      () => window.removeEventListener("keydown", this.onKeyDown),
      () => window.removeEventListener("keyup", this.onKeyUp),
      () => window.removeEventListener("blur", this.onBlur),
    ];
  }

  detach(): void {
    for (const detach of this.detachFns) {
      detach();
    }
    this.detachFns = [];
  }

  isSpacePanning(): boolean {
    return this.panning;
  }

  private onContextMenu = (event: MouseEvent): void => {
    if (this.engine.getActiveToolId() === "clone") {
      event.preventDefault();
    }
  };

  private onBlur = (): void => {
    this.spaceDown = false;
    this.panning = false;
    this.pointerDown = false;
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      this.spaceDown = true;
    }
    if (isEditableTarget(event.target) || event.defaultPrevented || event.isComposing) {
      return;
    }
    if (hasOpenDialog()) {
      return;
    }
    const guard = this.engine.keyboardGuard;
    if (guard && guard()) {
      return;
    }
    const tool = this.engine.getActiveTool();
    if (tool?.onKeyDown?.(event)) {
      event.preventDefault();
      return;
    }
    this.handleEngineKeys(event);
  };

  private handleEngineKeys(event: KeyboardEvent): void {
    const engine = this.engine;
    switch (event.key) {
      case "Escape":
        if (engine.selection.isActive()) {
          engine.selection.clear();
          event.preventDefault();
        }
        break;
      case "x":
      case "X":
        engine.swapColors();
        event.preventDefault();
        break;
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight": {
        const step = event.shiftKey ? 1 : 10;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        engine.nudgeSelectedLayer(dx, dy);
        event.preventDefault();
        break;
      }
      default:
        break;
    }
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      this.spaceDown = false;
      if (this.panning) {
        this.panning = false;
        this.engine.setPanningCursor(false);
      }
    }
  };

  private toStageCoords(event: PointerEvent | WheelEvent): Point {
    const canvas = this.engine.getMainCanvas();
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private buildPointerInfo(event: PointerEvent, stagePoint: Point): PointerInfo {
    const world = this.engine.zoomView.toWorld(stagePoint.x, stagePoint.y);
    const now = Date.now();
    if (this.lastEvent) {
      const dt = Math.max(1, now - this.lastEvent.time);
      const dx = event.clientX - this.lastEvent.clientX;
      const dy = event.clientY - this.lastEvent.clientY;
      const speed = Math.sqrt(dx * dx + dy * dy) / dt;
      this.speedAverage = this.speedAverage === 0 ? speed : this.speedAverage * 0.7 + speed * 0.3;
    }
    this.lastEvent = { clientX: event.clientX, clientY: event.clientY, time: now };
    const config = this.engine.config;
    return {
      x: world.x,
      y: world.y,
      clickX: this.pointerDown ? this.clickWorld.x : world.x,
      clickY: this.pointerDown ? this.clickWorld.y : world.y,
      lastX: this.lastWorld.x,
      lastY: this.lastWorld.y,
      isDrag: this.pointerDown,
      isValid: world.x >= 0 && world.y >= 0 && world.x <= config.width && world.y <= config.height,
      pressure: event.pressure > 0 ? event.pressure : 0.5,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey || event.metaKey,
      altKey: event.altKey,
      button: event.button,
      speedAverage: this.speedAverage,
    };
  }

  private clickWorld: Point = { x: 0, y: 0 };
  private lastWorld: Point = { x: 0, y: 0 };

  private onPointerDown = (event: PointerEvent): void => {
    const stagePoint = this.toStageCoords(event);
    const shouldPan = this.spaceDown || event.button === 1;
    if (shouldPan) {
      this.panning = true;
      this.panStart = { x: event.clientX, y: event.clientY };
      const pan = this.engine.zoomView.getPan();
      this.panOrigin = { x: pan.x, y: pan.y };
      this.engine.setPanningCursor(true);
      event.preventDefault();
      return;
    }
    const world = this.engine.zoomView.toWorld(stagePoint.x, stagePoint.y);
    this.clickWorld = world;
    this.lastWorld = world;
    this.pointerDown = true;
    this.speedAverage = 0;
    this.lastEvent = null;
    if (event.target instanceof Element && typeof event.target.setPointerCapture === "function") {
      try {
        event.target.setPointerCapture(event.pointerId);
      } catch {
        // 指针可能已释放，忽略捕获失败
      }
    }
    const info = this.buildPointerInfo(event, stagePoint);
    this.engine.mouseWorld = { x: info.x, y: info.y };
    this.engine.mouseCanvas = stagePoint;
    const tool = this.engine.getActiveTool();
    tool?.onPointerDown(info);
    this.engine.requestRender();
    this.engine.notify();
  };

  private onPointerMove = (event: PointerEvent): void => {
    this.pendingMove = event;
    if (this.lastMoveRaf !== 0) {
      return;
    }
    this.lastMoveRaf = requestAnimationFrame(() => {
      this.lastMoveRaf = 0;
      const pending = this.pendingMove;
      this.pendingMove = null;
      if (!pending) {
        return;
      }
      this.processPointerMove(pending);
    });
  };

  private processPointerMove(event: PointerEvent): void {
    const stagePoint = this.toStageCoords(event);
    if (this.panning) {
      const pan = this.engine.zoomView.getPan();
      this.engine.zoomView.setPan(
        this.panOrigin.x + (event.clientX - this.panStart.x),
        this.panOrigin.y + (event.clientY - this.panStart.y),
      );
      this.engine.requestRender();
      this.engine.notify();
      return;
    }
    const info = this.buildPointerInfo(event, stagePoint);
    this.engine.mouseWorld = { x: info.x, y: info.y };
    this.engine.mouseCanvas = stagePoint;
    const tool = this.engine.getActiveTool();
    if (this.pointerDown) {
      tool?.onPointerMove(info);
      this.engine.requestRender();
    } else {
      this.engine.requestRender();
    }
    this.engine.notifyThrottled();
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (this.panning && (event.button === 1 || this.spaceDown)) {
      this.panning = false;
      this.engine.setPanningCursor(false);
      return;
    }
    if (!this.pointerDown) {
      return;
    }
    this.pointerDown = false;
    const stagePoint = this.toStageCoords(event);
    const info = this.buildPointerInfo(event, stagePoint);
    const tool = this.engine.getActiveTool();
    tool?.onPointerUp(info);
    this.engine.requestRender();
    this.engine.notify();
  };

  private onPointerLeave = (): void => {
    this.engine.mouseWorld = null;
    this.engine.mouseCanvas = null;
    this.engine.notifyThrottled();
    this.engine.requestRender();
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const stagePoint = this.toStageCoords(event);
    const zoomView = this.engine.zoomView;
    if (event.ctrlKey || event.metaKey) {
      const factor = Math.exp(-event.deltaY * 0.01);
      zoomView.scaleAt(stagePoint.x, stagePoint.y, factor);
    } else if (Math.abs(event.deltaY) >= 50 || !Number.isInteger(event.deltaY)) {
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomView.scaleAt(stagePoint.x, stagePoint.y, factor);
    } else {
      zoomView.move(-event.deltaX, -event.deltaY);
    }
    this.engine.syncZoomFromView();
    this.engine.requestRender();
    this.engine.notify();
  };
}
