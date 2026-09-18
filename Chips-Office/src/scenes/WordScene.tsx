import "@genoffice/ui/tokens.css";
import "@genoffice/ui/screentip.css";
import "@genoffice/ui/color-picker.css";
import "@genoffice/ui/dropdown.css";
import "../apps/word/renderer/styles.css";
import "../apps/word/renderer/fonts/fonts.css";
import { installScreenTips } from "@genoffice/ui";
import { App as WordApp } from "../apps/word/renderer/App";
import { LocaleProvider, setModuleLang } from "../apps/word/renderer/i18n/locale";
import { installWordBridge } from "../bridge/word/install";
import { chipsClient } from "../runtime/chips-client";

installScreenTips();
setModuleLang("zh");

let bridgeInstalled = false;
if (!bridgeInstalled) {
  installWordBridge(chipsClient);
  bridgeInstalled = true;
}

export function WordScene(): React.ReactElement {
  return (
    <LocaleProvider initial="zh">
      <WordApp />
    </LocaleProvider>
  );
}
