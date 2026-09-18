import "@genoffice/ui/tokens.css";
import "@genoffice/ui/screentip.css";
import "@genoffice/ui/color-picker.css";
import "@genoffice/ui/dropdown.css";
import "../apps/pdf/renderer/styles.css";
import { installScreenTips } from "@genoffice/ui";
import PdfApp from "../apps/pdf/renderer/App";
import { LocaleProvider, setModuleLang } from "../apps/pdf/renderer/i18n/locale";
import { installPdfBridge } from "../bridge/pdf/install";
import { chipsClient } from "../runtime/chips-client";

installScreenTips();
setModuleLang("zh");

let bridgeInstalled = false;
if (!bridgeInstalled) {
  installPdfBridge(chipsClient);
  bridgeInstalled = true;
}

export function PdfScene(): React.ReactElement {
  return (
    <LocaleProvider initial="zh">
      <PdfApp />
    </LocaleProvider>
  );
}
