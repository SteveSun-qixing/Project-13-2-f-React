/** exceljs 的 ARGB 颜色（"FFRRGGBB"）→ CSS 十六进制（"#RRGGBB"） */
export function argbToHex(argb: string | undefined): string | undefined {
  if (!argb) {
    return undefined;
  }
  const normalized = argb.replace("#", "").toUpperCase();
  if (normalized.length === 8) {
    const alpha = parseInt(normalized.slice(0, 2), 16);
    if (alpha === 0) {
      return undefined;
    }
    return `#${normalized.slice(2)}`;
  }
  if (normalized.length === 6) {
    return `#${normalized}`;
  }
  return undefined;
}

/** CSS 十六进制（"#RRGGBB" 或 "#RRGGBBAA"）→ exceljs ARGB（"FFRRGGBB"） */
export function hexToArgb(hex: string | undefined): string | undefined {
  if (!hex) {
    return undefined;
  }
  const normalized = hex.replace("#", "").toUpperCase();
  if (normalized.length === 8) {
    return normalized;
  }
  if (normalized.length === 6) {
    return `FF${normalized}`;
  }
  return undefined;
}
