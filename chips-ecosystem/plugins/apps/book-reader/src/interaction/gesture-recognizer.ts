export interface SwipeGesture {
  deltaX: number;
  deltaY: number;
}

export class GestureRecognizer {
  private activePointer: {
    pointerId: number;
    startX: number;
    startY: number;
  } | null = null;

  public start(pointerId: number, clientX: number, clientY: number): void {
    this.activePointer = {
      pointerId,
      startX: clientX,
      startY: clientY,
    };
  }

  public finish(pointerId: number, clientX: number, clientY: number): SwipeGesture | null {
    if (!this.activePointer || this.activePointer.pointerId !== pointerId) {
      return null;
    }

    const gesture = {
      deltaX: clientX - this.activePointer.startX,
      deltaY: clientY - this.activePointer.startY,
    };
    this.activePointer = null;
    return gesture;
  }

  public cancel(): void {
    this.activePointer = null;
  }
}
