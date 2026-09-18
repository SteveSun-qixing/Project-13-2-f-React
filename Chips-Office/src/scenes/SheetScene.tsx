import "@genoffice/ui/tokens.css";
import "@genoffice/ui/screentip.css";
import "@genoffice/ui/color-picker.css";
import "@genoffice/ui/dropdown.css";
import "@univerjs/preset-sheets-core/lib/index.css";
import "../apps/sheet/renderer/styles.css";
import { installScreenTips } from "@genoffice/ui";
import { App as SheetApp } from "../apps/sheet/renderer/App";
import { installCanvasFontFallback, registerCellFontAliases } from "../apps/sheet/renderer/cell-font-fallback";
import { LocaleProvider, setModuleLang } from "../apps/sheet/renderer/i18n/locale";
import { installSheetBridge } from "../bridge/sheet/install";
import { chipsClient } from "../runtime/chips-client";

installScreenTips();
installCanvasFontFallback();
setModuleLang("zh");

// Canvas fillText never triggers @font-face downloads, so the bundled Carlito
// faces (Calibri/Aptos aliases in styles.css) must be loaded before Univer's
// first skeleton — MDW, wrap points, and #### overflow all measure with them.
void (async () => {
  const loads: Promise<unknown>[] = [registerCellFontAliases()];
  for (const variant of ["", "bold ", "italic ", "italic bold "]) {
    for (const family of ["Calibri", "Aptos", "'Aptos Narrow'", "Carlito"]) {
      loads.push(document.fonts?.load?.(`${variant}16px ${family}`)?.catch(() => {}) ?? []);
    }
  }
  await Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, 3000))]);
})();

let bridgeInstalled = false;
if (!bridgeInstalled) {
  installSheetBridge(chipsClient);
  bridgeInstalled = true;
}

export function SheetScene(): React.ReactElement {
  return (
    <LocaleProvider initial="zh">
      <SheetApp />
    </LocaleProvider>
  );
}
