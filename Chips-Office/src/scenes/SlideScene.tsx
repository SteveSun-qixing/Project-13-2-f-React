import "@genoffice/ui/tokens.css";
import "@genoffice/ui/screentip.css";
import "@genoffice/ui/color-picker.css";
import "@genoffice/ui/dropdown.css";
import "../apps/slide/renderer/styles.css";
import { installScreenTips } from "@genoffice/ui";
import { App as SlideApp } from "../apps/slide/renderer/App";
import { LocaleProvider, setModuleLang } from "../apps/slide/renderer/i18n/locale";
import { installSlideBridge } from "../bridge/slide/install";
import { chipsClient } from "../runtime/chips-client";

installScreenTips();
setModuleLang("zh");

// Canvas fillText never triggers @font-face downloads, so the bundled document fonts
// (Carlito ↔ Calibri) must be loaded explicitly or Konva silently draws the fallback face.
for (const variant of ["", "bold ", "italic ", "italic bold "]) {
  document.fonts?.load?.(`${variant}16px Carlito`).catch(() => {});
  document.fonts?.load?.(`${variant}16px 'Carlito GO'`).catch(() => {});
}

let bridgeInstalled = false;
if (!bridgeInstalled) {
  installSlideBridge(chipsClient);
  bridgeInstalled = true;
}

export function SlideScene(): React.ReactElement {
  return (
    <LocaleProvider initial="zh">
      <SlideApp />
    </LocaleProvider>
  );
}
