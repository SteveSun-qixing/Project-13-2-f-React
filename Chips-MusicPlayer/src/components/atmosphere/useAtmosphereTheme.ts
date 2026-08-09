import { useEffect } from "react";
import { applyAtmosphereColors, clearAtmosphereColors } from "../../utils/atmosphere-theme";
import type { RGBColor } from "../../utils/color";

export function useAtmosphereTheme(): (colors: readonly RGBColor[]) => void {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    return () => {
      clearAtmosphereColors();
    };
  }, []);

  return applyAtmosphereColors;
}
