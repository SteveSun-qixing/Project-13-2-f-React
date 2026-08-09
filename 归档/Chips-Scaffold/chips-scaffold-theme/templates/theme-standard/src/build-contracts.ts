import fs from "node:fs/promises";
import path from "node:path";

interface ThemeContractComponent {
  component: string;
  scope: string;
  parts: string[];
  states: string[];
  tokens?: string[];
  requiredTokens?: string[];
  optionalTokens?: string[];
  a11yConstraints?: Array<Record<string, unknown>>;
  motionConstraints?: Array<Record<string, unknown>>;
}

interface ThemeInterfaceContract {
  schemaVersion: string;
  contractVersion: string;
  components: ThemeContractComponent[];
}

interface ThemeMinFunctionalSet {
  schemaVersion: string;
  contractVersion: string;
  requiredComponents: string[];
}

type ThemeContractGenerator = {
  buildThemeInterfaceContract: (
    componentContracts: ThemeContractComponent[],
    options?: { schemaVersion?: string; contractVersion?: string }
  ) => ThemeInterfaceContract;
  buildThemeMinFunctionalSet: (
    componentContracts: ThemeContractComponent[],
    options?: { schemaVersion?: string; contractVersion?: string }
  ) => ThemeMinFunctionalSet;
  loadComponentContracts: (contractDir?: string) => ThemeContractComponent[];
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const loadThemeContractGenerator = async (): Promise<ThemeContractGenerator> => {
  return import("@chips/theme-contracts") as Promise<ThemeContractGenerator>;
};

export const buildContracts = async (projectRoot = process.cwd()): Promise<{
  interfaceContract: ThemeInterfaceContract;
  minFunctionalSet: ThemeMinFunctionalSet;
}> => {
  const generator = await loadThemeContractGenerator();
  const componentContracts = generator.loadComponentContracts();
  const interfaceContract = generator.buildThemeInterfaceContract(componentContracts);
  const minFunctionalSet = generator.buildThemeMinFunctionalSet(componentContracts);
  const contractsDir = path.join(projectRoot, "contracts");

  const nextFiles = new Map([
    [path.join(contractsDir, "theme-interface.contract.json"), interfaceContract],
    [path.join(contractsDir, "theme-min-functional-set.json"), minFunctionalSet]
  ]);

  for (const [filePath, value] of nextFiles.entries()) {
    const nextContent = `${JSON.stringify(value, null, 2)}\n`;
    let currentContent = "";
    try {
      currentContent = await fs.readFile(filePath, "utf-8");
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw error;
      }
    }
    if (currentContent !== nextContent) {
      await writeJson(filePath, value);
    }
  }

  return { interfaceContract, minFunctionalSet };
};

const main = async (): Promise<void> => {
  const { interfaceContract } = await buildContracts();

  // eslint-disable-next-line no-console
  console.log(`Theme contracts generated: ${interfaceContract.components.length} component contracts.`);
};

if (require.main === module) {
  void main();
}
