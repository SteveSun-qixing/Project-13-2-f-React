import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureRequiredTokenPrefixes,
  flattenTokens,
  loadTokenSources,
  resolveTokenReferences
} from "../packages/tokens/src/token-utils.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../packages/tokens/tokens");

const tokenTree = loadTokenSources(rootDir);
const flat = flattenTokens(tokenTree);
const resolved = resolveTokenReferences(flat);

ensureRequiredTokenPrefixes(resolved, [
  "chips.ref.",
  "chips.sys.",
  "chips.motion.",
  "chips.layout.",
  "chips.comp.view.",
  "chips.comp.box.",
  "chips.comp.stack.",
  "chips.comp.inline.",
  "chips.comp.grid.",
  "chips.comp.section.",
  "chips.comp.scroll-view.",
  "chips.comp.spacer.",
  "chips.comp.divider.",
  "chips.comp.split-view.",
  "chips.comp.text.",
  "chips.comp.label.",
  "chips.comp.icon.",
  "chips.comp.icon-button.",
  "chips.comp.toggle-button.",
  "chips.comp.badge.",
  "chips.comp.tag.",
  "chips.comp.avatar.",
  "chips.comp.spinner.",
  "chips.comp.progress.",
  "chips.comp.text-field.",
  "chips.comp.text-area.",
  "chips.comp.search-field.",
  "chips.comp.secure-field.",
  "chips.comp.segmented-control.",
  "chips.comp.combo-box.",
  "chips.comp.number-input.",
  "chips.comp.stepper.",
  "chips.comp.slider.",
  "chips.comp.date-picker.",
  "chips.comp.time-picker.",
  "chips.comp.image.",
  "chips.comp.media.",
  "chips.comp.error-state.",
  "chips.comp.button.",
  "chips.comp.input.",
  "chips.comp.checkbox.",
  "chips.comp.radio.",
  "chips.comp.switch.",
  "chips.comp.select.",
  "chips.comp.dialog.",
  "chips.comp.popover.",
  "chips.comp.tabs.",
  "chips.comp.menu.",
  "chips.comp.tooltip.",
  "chips.comp.form.",
  "chips.comp.virtual-list.",
  "chips.comp.data-grid.",
  "chips.comp.tree.",
  "chips.comp.date-time.",
  "chips.comp.command-palette.",
  "chips.comp.split-pane.",
  "chips.comp.dock-panel.",
  "chips.comp.inspector.",
  "chips.comp.panel-header.",
  "chips.comp.card-shell.",
  "chips.comp.tool-window.",
  "chips.comp.error-boundary.",
  "chips.comp.loading-boundary.",
  "chips.comp.notification.",
  "chips.comp.toast.",
  "chips.comp.empty-state.",
  "chips.comp.skeleton.",
  "chips.comp.card-cover-frame.",
  "chips.comp.composite-card-window."
]);

console.log(`[tokens] validated ${Object.keys(resolved).length} keys`);
