import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareThemeInterfaceContract,
  compareThemeMinFunctionalSet,
  loadComponentContracts
} from "../packages/theme-contracts/src/validator.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(root, "..");
const componentContractDir = path.join(root, "packages", "theme-contracts", "contracts", "components");
const officialThemeRoots = [
  path.join(workspaceRoot, "ThemePack", "Chips-default"),
  path.join(workspaceRoot, "ThemePack", "Chips-theme-default-dark")
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateThemeRoot(themeRoot, expectedContracts) {
  const interfacePath = path.join(themeRoot, "contracts", "theme-interface.contract.json");
  const minFunctionalSetPath = path.join(themeRoot, "contracts", "theme-min-functional-set.json");
  const interfaceFailures = compareThemeInterfaceContract(readJson(interfacePath), expectedContracts);
  const minFunctionalSetFailures = compareThemeMinFunctionalSet(readJson(minFunctionalSetPath), expectedContracts);
  return {
    interfaceFailures,
    minFunctionalSetFailures
  };
}

const expectedContracts = loadComponentContracts(componentContractDir);
const allFailures = [];

for (const themeRoot of officialThemeRoots) {
  const failures = validateThemeRoot(themeRoot, expectedContracts);
  if (failures.interfaceFailures.length > 0 || failures.minFunctionalSetFailures.length > 0) {
    allFailures.push({
      theme: path.relative(workspaceRoot, themeRoot),
      failures
    });
  }
}

if (allFailures.length > 0) {
  console.error(
    JSON.stringify(
      {
        message: "Official ThemePack contracts drifted from Chips-ComponentLibrary component contracts.",
        failures: allFailures
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(`[theme-contracts] official ThemePack contracts match ${expectedContracts.length} component contracts`);
