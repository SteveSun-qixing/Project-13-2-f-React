import { parseCoverRatio } from '../../../utils/card-cover';

export interface CoverPreviewFrameSize {
  width: number;
  height: number;
}

export interface ResolveCoverPreviewFrameSizeInput {
  ratio: string;
  containerWidth: number;
  containerHeight: number;
  preferredWidth?: number;
  horizontalPadding?: number;
  verticalPadding?: number;
}

export function resolveCoverPreviewFrameSize({
  ratio,
  containerWidth,
  containerHeight,
  preferredWidth = 300,
  horizontalPadding = 40,
  verticalPadding = 40,
}: ResolveCoverPreviewFrameSizeInput): CoverPreviewFrameSize {
  const { width: ratioWidth, height: ratioHeight } = parseCoverRatio(ratio);
  const availableWidth = Math.max(0, containerWidth - horizontalPadding);
  const availableHeight = Math.max(0, containerHeight - verticalPadding);

  if (!availableWidth || !availableHeight) {
    return {
      width: 0,
      height: 0,
    };
  }

  let width = Math.min(preferredWidth, availableWidth);
  let height = width * (ratioHeight / ratioWidth);

  if (height > availableHeight) {
    height = availableHeight;
    width = height * (ratioWidth / ratioHeight);
  }

  if (width > availableWidth) {
    width = availableWidth;
    height = width * (ratioHeight / ratioWidth);
  }

  return {
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
  };
}
