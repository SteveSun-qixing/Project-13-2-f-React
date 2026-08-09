import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContractDirectory } from "../packages/theme-contracts/src/validator.js";

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenPath = path.join(base, "packages/tokens/dist/json/tokens.json");
const contractDir = path.join(base, "packages/theme-contracts/contracts/components");

if (!fs.existsSync(tokenPath)) {
  throw new Error("THEME_CONTRACT_VALIDATION_BLOCKED:TOKENS_NOT_BUILT");
}

const tokenTree = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
const files = validateContractDirectory(contractDir, tokenTree);

console.log(`[theme-contracts] validated ${files.length} contracts`);
