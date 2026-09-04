export const ZOOM_MIN = 0.01;
export const ZOOM_MAX = 16;

export const ZOOM_STEPS = [
  0.01, 0.02, 0.04, 0.08, 0.125, 0.166, 0.25, 0.333, 0.5, 0.666, 1, 1.5, 2, 3, 4, 6, 8, 12, 16,
];

export function clampZoom(value: number): number {
  if (value < ZOOM_MIN) return ZOOM_MIN;
  if (value > ZOOM_MAX) return ZOOM_MAX;
  return value;
}

export function nextZoomStep(current: number): number {
  for (const step of ZOOM_STEPS) {
    if (step > current + 1e-9) {
      return step;
    }
  }
  return ZOOM_MAX;
}

export function previousZoomStep(current: number): number {
  let result = ZOOM_MIN;
  for (const step of ZOOM_STEPS) {
    if (step < current - 1e-9) {
      result = step;
    }
  }
  return result;
}
