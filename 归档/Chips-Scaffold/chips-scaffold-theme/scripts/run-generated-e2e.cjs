#!/usr/bin/env node

/* eslint-disable no-console */
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const scaffoldPackageRoot = path.resolve(__dirname, "..");
const scaffoldRoot = path.resolve(scaffoldPackageRoot, "..");
const ecosystemRoot = path.resolve(scaffoldRoot, "..");
const sdkCliPath = path.join(ecosystemRoot, "Chips-SDK", "cli", "index.js");

const TEST_NPM_OVERRIDES = {
  tldts: "7.0.30",
  "tldts-core": "7.0.30"
};

const run = (command, args, cwd, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, {
      cwd,
      stdio: "inherit",
      env
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with ${
            typeof code === "number" ? `code ${code}` : `signal ${signal ?? "UNKNOWN"}`
          }`
        )
      );
    });
  });

const symlinkDir = async (source, target) => {
  const type = process.platform === "win32" ? "junction" : "dir";
  await fsp.symlink(source, target, type);
};

const withWritableNpmCache = (env, cacheRoot) => ({
  ...env,
  NPM_CONFIG_CACHE: cacheRoot,
  npm_config_cache: cacheRoot
});

const toPosixPath = (value) => value.split(path.sep).join("/");

const createThemeProject = async (sandboxRoot, env) => {
  const targetRelativePath = path.join("validation-projects", "theme-smoke");
  const targetDir = path.join(sandboxRoot, targetRelativePath);

  await run(
    "node",
    [
      sdkCliPath,
      "create",
      "theme",
      targetRelativePath,
      "--theme-id",
      "theme.e2e.smoke",
      "--plugin-id",
      "chips.theme.e2e.smoke",
      "--display-name",
      "Theme Smoke",
      "--publisher",
      "chips-e2e",
      "--description",
      "Theme scaffold generated project smoke theme."
    ],
    sandboxRoot,
    env
  );

  const requiredFiles = [
    "manifest.yaml",
    "README.md",
    "package.json",
    "tokens/ref.json",
    "tokens/sys.json",
    "tokens/motion.json",
    "tokens/layout.json",
    "tokens/comp/button.json",
    "src/build-tokens.ts",
    "src/build-contracts.ts",
    "src/build-css.ts",
    "src/validate-theme.ts",
    "tests/contract.spec.ts",
    "preview/theme-matrix.json",
    "icons/variablefont/MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2"
  ];

  for (const fileName of requiredFiles) {
    await fsp.access(path.join(targetDir, fileName));
  }

  return { targetRelativePath: toPosixPath(targetRelativePath), targetDir };
};

const assertGeneratedProjectContract = async (sandboxRoot, targetRelativePath, targetDir) => {
  const rootPackage = JSON.parse(await fsp.readFile(path.join(sandboxRoot, "package.json"), "utf-8"));
  assert.equal(
    rootPackage.workspaces.includes(targetRelativePath),
    true,
    "chipsdev create theme should register generated project in root workspaces"
  );

  const createdPackage = JSON.parse(await fsp.readFile(path.join(targetDir, "package.json"), "utf-8"));
  assert.equal(createdPackage.name, "chips.theme.e2e.smoke");
  assert.equal(createdPackage.version, "1.0.0");
  assert.equal(createdPackage.devDependencies["chips-sdk"], "^0.1.0");
  assert.equal(createdPackage.devDependencies["@chips/theme-contracts"], "0.1.0");
  assert.equal(createdPackage.scripts.verify.includes("npm run package"), true);
  assert.equal(createdPackage.volta.extends, "../../package.json");

  const manifestText = await fsp.readFile(path.join(targetDir, "manifest.yaml"), "utf-8");
  assert.match(manifestText, /id:\s*"chips\.theme\.e2e\.smoke"/);
  assert.match(manifestText, /type:\s*"theme"/);
  assert.match(manifestText, /themeId:\s*"theme\.e2e\.smoke"/);
  assert.match(manifestText, /displayName:\s*"Theme Smoke"/);
  assert.match(manifestText, /tokens:\s*"dist\/tokens\.json"/);
  assert.match(manifestText, /themeCss:\s*"dist\/theme\.css"/);
  assert.match(manifestText, /contract:\s*\.\/contracts\/theme-interface\.contract\.json/);
  assert.match(manifestText, /minFunctionalSet:\s*\.\/contracts\/theme-min-functional-set\.json/);

  const matrix = JSON.parse(await fsp.readFile(path.join(targetDir, "preview", "theme-matrix.json"), "utf-8"));
  assert.equal(matrix.themeId, "theme.e2e.smoke");
  assert.equal(matrix.themeVersion, "1.0.0");

  return createdPackage;
};

const assertPackagedArtifacts = async (targetDir, createdPackage) => {
  await fsp.access(path.join(targetDir, "dist", "tokens.json"));
  await fsp.access(path.join(targetDir, "dist", "theme.css"));
  await fsp.access(path.join(targetDir, "dist", "icons", "variablefont", "MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2"));

  const packagePath = path.join(targetDir, "dist", `${createdPackage.name}-${createdPackage.version}.cpk`);
  await fsp.access(packagePath);

  const packageNames = (await fsp.readdir(path.join(targetDir, "dist"))).filter((name) => name.endsWith(".cpk"));
  assert.deepEqual(packageNames, [`${createdPackage.name}-${createdPackage.version}.cpk`]);
  return packagePath;
};

const assertHostRuntime = async ({ packagePath, createdPackage }) => {
  await run("npm", ["run", "build"], path.join(ecosystemRoot, "Chips-Host"));

  const { HostApplication } = require(path.join(
    ecosystemRoot,
    "Chips-Host",
    "dist",
    "src",
    "main",
    "core",
    "host-application.js"
  ));
  const { RuntimeClient } = require(path.join(
    ecosystemRoot,
    "Chips-Host",
    "dist",
    "src",
    "renderer",
    "runtime-client.js"
  ));
  const { PluginRuntime } = require(path.join(
    ecosystemRoot,
    "Chips-Host",
    "dist",
    "src",
    "runtime",
    "plugin-runtime.js"
  ));

  const hostWorkspace = await fsp.mkdtemp(path.join(os.tmpdir(), "chips-theme-scaffold-host-"));
  let app;

  try {
    const bootstrapRuntime = new PluginRuntime(hostWorkspace, {
      locale: "zh-CN",
      themeId: "chips-official.default-theme"
    });
    await bootstrapRuntime.load();
    const defaultTheme = await bootstrapRuntime.install(
      path.join(ecosystemRoot, "ThemePack", "Chips-default", "manifest.yaml")
    );
    await bootstrapRuntime.enable(defaultTheme.manifest.id);

    app = new HostApplication({ workspacePath: hostWorkspace });
    await app.start();

    const runtimeClient = new RuntimeClient(app.createBridge(), {
      defaultTimeout: 5_000,
      maxRetries: 1,
      retryDelay: 10,
      retryBackoff: 2,
      enableRetry: true
    });

    const installed = await runtimeClient.invoke("plugin.install", {
      manifestPath: packagePath
    });
    assert.equal(installed.pluginId, createdPackage.name);
    await runtimeClient.invoke("plugin.enable", { pluginId: installed.pluginId });

    const listed = await runtimeClient.invoke("theme.list", {});
    assert.equal(
      listed.themes.some((theme) => theme.id === "theme.e2e.smoke"),
      true,
      "generated theme should be visible after plugin.enable"
    );

    await runtimeClient.invoke("theme.apply", { id: "theme.e2e.smoke" });
    const current = await runtimeClient.invoke("theme.getCurrent", {});
    assert.equal(current.themeId, "theme.e2e.smoke");

    const css = await runtimeClient.invoke("theme.getAllCss", {});
    assert.equal(css.themeId, "theme.e2e.smoke");
    assert.match(css.css, /Material Symbols Outlined/);
    assert.match(css.css, /data-scope="button"/);

    const resolved = await runtimeClient.invoke("theme.resolve", {
      chain: ["theme.e2e.smoke"]
    });
    assert.equal(resolved.resolved[0].id, "theme.e2e.smoke");
    assert.equal(resolved.summary.status, "complete");
    assert.ok(Object.keys(resolved.tokens).length > 0);

    const contract = await runtimeClient.invoke("theme.contract.get", {});
    assert.equal(contract.themeId, "theme.e2e.smoke");
    assert.equal(contract.summary.status, "complete");
    assert.equal(contract.components.some((component) => component.component === "button"), true);
  } finally {
    if (app) {
      await app.stop();
    }
    await fsp.rm(hostWorkspace, { recursive: true, force: true });
  }
};

async function main() {
  console.log("Running chips-scaffold-theme generated project e2e...");

  const sandboxRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "chips-theme-scaffold-e2e-"));
  const linkedEntries = ["Chips-SDK", "Chips-Scaffold", "Chips-ComponentLibrary"];

  try {
    for (const entry of linkedEntries) {
      await symlinkDir(path.join(ecosystemRoot, entry), path.join(sandboxRoot, entry));
    }

    await fsp.writeFile(
      path.join(sandboxRoot, "package.json"),
      JSON.stringify(
        {
          name: "chips-ecosystem-workspace",
          private: true,
          volta: {
            node: process.versions.node,
            npm: "10.9.3"
          },
          workspaces: [
            "Chips-*",
            "Chips-BaseCardPlugin/*",
            "Chips-ComponentLibrary/packages/*",
            "Chips-ComponentLibrary/packages/adapters/*",
            "Chips-Scaffold/*",
            "ThemePack/*"
          ],
          overrides: TEST_NPM_OVERRIDES
        },
        null,
        2
      ),
      "utf-8"
    );

    const env = withWritableNpmCache(
      {
        ...process.env,
        CHIPS_ECOSYSTEM_ROOT: sandboxRoot
      },
      path.join(sandboxRoot, ".npm-cache")
    );

    const generated = await createThemeProject(sandboxRoot, env);
    const createdPackage = await assertGeneratedProjectContract(
      sandboxRoot,
      generated.targetRelativePath,
      generated.targetDir
    );

    await run("npm", ["install"], sandboxRoot, env);
    await run("npm", ["run", "verify"], generated.targetDir, env);
    const packagePath = await assertPackagedArtifacts(generated.targetDir, createdPackage);
    await assertHostRuntime({ packagePath, createdPackage });

    console.log("E2E: 主题脚手架生成工程真实工作区与 Host 主题链路通过。");
  } finally {
    await fsp.rm(sandboxRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("E2E: 生成主题工程真实链路失败", error);
  process.exitCode = 1;
});
