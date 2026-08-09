import React, { useEffect, useRef } from "react";
import { extractArtworkPalette } from "../../utils/artwork-palette";
import type { RGBColor } from "../../utils/color";
import { useAtmosphereTheme } from "./useAtmosphereTheme";

const FALLBACK_ATMOSPHERE_COLORS: readonly RGBColor[] = [
  [232, 232, 232],
  [197, 197, 199],
  [255, 255, 255],
  [150, 150, 150],
];

class Slice {
  private angle = Math.random() * Math.PI * 2;
  private readonly velocity = (Math.random() - 0.5) * 0.005;
  private readonly scale = 1.2;

  constructor(
    private readonly image: HTMLImageElement,
    private readonly index: number,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  update(): void {
    this.angle += this.velocity;
  }

  draw(): void {
    const context = this.canvas.getContext("2d");
    if (!context) {
      return;
    }

    const { width, height } = this.canvas;
    const centerX = this.index % 2 === 0 ? width * 0.25 : width * 0.75;
    const centerY = this.index < 2 ? height * 0.25 : height * 0.75;
    const sourceWidth = this.image.width / 2;
    const sourceHeight = this.image.height / 2;
    const sourceX = (this.index % 2) * sourceWidth;
    const sourceY = Math.floor(this.index / 2) * sourceHeight;
    const drawSize = Math.max(width, height) * 0.6;

    context.save();
    context.translate(centerX, centerY);
    context.rotate(this.angle);
    context.scale(this.scale, this.scale);
    context.globalAlpha = 0.7;
    context.drawImage(
      this.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -drawSize / 2,
      -drawSize / 2,
      drawSize,
      drawSize,
    );
    context.restore();
  }
}

export interface AtmosphereCanvasProps {
  artworkUri: string;
}

export function AtmosphereCanvas(props: AtmosphereCanvasProps): React.ReactElement {
  const { artworkUri } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const applyAtmosphereColors = useAtmosphereTheme();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    let animationFrameId = 0;
    let disposed = false;

    const artwork = new Image();
    artwork.decoding = "async";
    if (/^https?:/i.test(artworkUri)) {
      artwork.crossOrigin = "anonymous";
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const stopAnimation = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener("resize", resizeCanvas);
    };

    const paintFallback = () => {
      applyAtmosphereColors(FALLBACK_ATMOSPHERE_COLORS);
      resizeCanvas();
      context.clearRect(0, 0, canvas.width, canvas.height);
    };

    artwork.onload = () => {
      if (disposed) {
        return;
      }

      try {
        const tempCanvas = document.createElement("canvas");
        const tempContext = tempCanvas.getContext("2d");
        if (!tempContext) {
          throw new Error("temporary canvas context unavailable");
        }

        tempCanvas.width = 100;
        tempCanvas.height = Math.max(1, Math.round(100 * (artwork.height / artwork.width)));
        tempContext.drawImage(artwork, 0, 0, tempCanvas.width, tempCanvas.height);
        const imageData = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const palette = extractArtworkPalette(imageData, 4);
        applyAtmosphereColors(palette.length > 0 ? palette : FALLBACK_ATMOSPHERE_COLORS);
      } catch {
        applyAtmosphereColors(FALLBACK_ATMOSPHERE_COLORS);
      }

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      const slices = [0, 1, 2, 3].map((index) => new Slice(artwork, index, canvas));

      const animate = () => {
        context.globalCompositeOperation = "source-over";
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.globalCompositeOperation = "screen";
        for (const slice of slices) {
          slice.update();
          slice.draw();
        }
        animationFrameId = window.requestAnimationFrame(animate);
      };

      animate();
    };

    artwork.onerror = paintFallback;
    artwork.src = artworkUri;

    return () => {
      disposed = true;
      stopAnimation();
    };
  }, [applyAtmosphereColors, artworkUri]);

  return <canvas ref={canvasRef} className="canvas" aria-hidden="true" />;
}
