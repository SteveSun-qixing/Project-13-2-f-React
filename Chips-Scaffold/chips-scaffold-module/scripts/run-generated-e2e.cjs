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
  "tldts-core": "7.0.30",
};

const TEMPLATE_EXPECTATIONS = [
  {
    id: "module-standard",
    targetRelativePath: path.join("validation-projects", "module-smoke"),
    files: [
      "manifest.yaml",
      "README.md",
      "src/index.ts",
      "contracts/run.input.schema.json",
      "contracts/run.output.schema.json",
      "contracts/runAsync.input.schema.json",
      "contracts/runAsync.output.schema.json",
      "tests/unit/module-definition.test.ts",
    ],
  },
  {
    id: "module-pure-function",
    files: [
      "manifest.yaml",
      "README.md",
      "src/index.ts",
      "contracts/run.input.schema.json",
      "contracts/run.output.schema.json",
      "tests/unit/module-definition.test.ts",
    ],
  },
  {
    id: "module-file-conversion",
    files: [
      "manifest.yaml",
      "README.md",
      "src/index.ts",
      "contracts/convert.input.schema.json",
      "contracts/convert.output.schema.json",
      "tests/unit/module-definition.test.ts",
    ],
  },
  {
    id: "module-html-rendering",
    files: [
      "manifest.yaml",
      "README.md",
      "src/index.ts",
      "contracts/convert.input.schema.json",
      "contracts/convert.output.schema.json",
      "tests/unit/module-definition.test.ts",
    ],
  },
  {
    id: "module-image-processing",
    files: [
      "manifest.yaml",
      "README.md",
      "src/index.ts",
      "contracts/process.input.schema.json",
      "contracts/process.output.schema.json",
      "tests/unit/module-definition.test.ts",
    ],
  },
  {
    id: "module-color-extraction",
    files: [
      "manifest.yaml",
      "README.md",
      "src/index.ts",
      "contracts/pick.input.schema.json",
      "contracts/pick.output.schema.json",
      "tests/unit/module-definition.test.ts",
    ],
  },
  {
    id: "module-orchestration",
    files: [
      "manifest.yaml",
      "README.md",
      "src/index.ts",
      "contracts/execute.input.schema.json",
      "contracts/execute.output.schema.json",
      "tests/unit/module-definition.test.ts",
    ],
    consumes: ["module.example.step@^1.0.0"],
  },
];

const FORBIDDEN_RENDERED_PATTERNS = [
  /\{\{\s*[A-Z0-9_]+\s*\}\}/,
  /template\.json/,
  /mountModule/,
  /ctx\.services/,
  /ui\.surface/,
  /runtime\.tsx/,
  /\bchips dev\b/i,
  /TODO|FIXME/,
];

const HOST_FIXED_CLI_COMMAND_ROOTS = new Set([
  "help",
  "host",
  "start",
  "stop",
  "status",
  "config",
  "logs",
  "theme",
  "plugin",
  "update",
  "doctor",
  "open",
  "completion",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".yaml",
  ".yml",
  ".md",
  ".html",
  ".css",
  ".mjs",
  ".cjs",
]);

const run = (command, args, cwd, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, {
      cwd,
      stdio: "inherit",
      env,
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
  npm_config_cache: cacheRoot,
});

const toPosixPath = (value) => value.split(path.sep).join("/");

const listFiles = async (rootDir) => {
  const files = [];

  const walk = async (currentDir) => {
    const entries = await fsp.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        files.push(toPosixPath(path.relative(rootDir, absolutePath)));
      }
    }
  };

  await walk(rootDir);
  return files.sort();
};

const assertGeneratedProjectClean = async (targetDir, templateId) => {
  const files = await listFiles(targetDir);
  assert.equal(files.includes("template.json"), false, `${templateId} should not render template.json`);

  for (const relativePath of files) {
    const ext = path.extname(relativePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      continue;
    }
    const content = await fsp.readFile(path.join(targetDir, relativePath), "utf-8");
    for (const pattern of FORBIDDEN_RENDERED_PATTERNS) {
      assert.equal(
        pattern.test(content),
        false,
        `${templateId}:${relativePath} should not match forbidden pattern ${pattern}`
      );
    }
  }
};

const assertGeneratedManifestCliContract = async (targetDir, templateId) => {
  const manifestText = await fsp.readFile(path.join(targetDir, "manifest.yaml"), "utf-8");
  assert.match(manifestText, /cli:\n\s+commands:/, `${templateId} should declare cli.commands`);
  assert.match(manifestText, /target:\n\s+type:\s+module/, `${templateId} CLI target should be module`);
  assert.match(manifestText, /output:\n\s+mode:\s+json/, `${templateId} CLI output should be json`);
  assert.match(manifestText, /mapsTo:/, `${templateId} CLI parameters should map into payload`);
  assert.match(manifestText, /ui:\n\s+control:/, `${templateId} CLI parameters should carry TUI hints`);

  const commandPathMatch = manifestText.match(/commandPath:\s+([^\n]+)/);
  assert.ok(commandPathMatch, `${templateId} should declare commandPath`);
  const root = commandPathMatch[1].trim().split(/\s+/)[0];
  assert.equal(
    HOST_FIXED_CLI_COMMAND_ROOTS.has(root),
    false,
    `${templateId} CLI root should not shadow Host fixed commands`
  );

  for (const forbidden of [/^plugin\s*:/m, /^theme\s*:/m, /^themeId\s*:/m, /^displayName\s*:/m, /^layout\s*:/m, /^ui:\s*$/m]) {
    assert.equal(forbidden.test(manifestText), false, `${templateId} manifest should not declare ${forbidden}`);
  }
};

const createModuleProject = async (sandboxRoot, template, env) => {
  const targetRelativePath =
    template.targetRelativePath ??
    path.join("validation-projects", template.id.replace(/^module-/, "module-"));
  const targetDir = path.join(sandboxRoot, targetRelativePath);
  const suffix = template.id.replace(/^module-/, "").replace(/-/g, ".");
  const args = ["create", "module", targetRelativePath];

  if (template.id !== "module-standard") {
    args.push("--template", template.id);
    args.push("--plugin-id", `chips.module.e2e.${suffix}`);
    args.push("--capability", `module.e2e.${suffix}`);
  }

  for (const item of template.consumes ?? []) {
    args.push("--consumes", item);
  }

  await run("node", [sdkCliPath, ...args], sandboxRoot, env);

  for (const fileName of template.files) {
    await fsp.access(path.join(targetDir, fileName));
  }
  await assertGeneratedProjectClean(targetDir, template.id);
  await assertGeneratedManifestCliContract(targetDir, template.id);
  return { targetRelativePath: toPosixPath(targetRelativePath), targetDir };
};

const assertDefaultProjectContract = async (sandboxRoot, targetRelativePath, targetDir) => {
  const rootPackage = JSON.parse(await fsp.readFile(path.join(sandboxRoot, "package.json"), "utf-8"));
  assert.equal(
    rootPackage.workspaces.includes(targetRelativePath),
    true,
    "chipsdev-r create module should register generated project in root workspaces"
  );

  const createdPackage = JSON.parse(await fsp.readFile(path.join(targetDir, "package.json"), "utf-8"));
  for (const scriptName of ["lint", "typecheck", "test", "build", "validate", "package", "verify"]) {
    assert.equal(
      typeof createdPackage.scripts?.[scriptName],
      "string",
      `generated project should include npm script: ${scriptName}`
    );
  }
  assert.equal(createdPackage.scripts.verify.includes("npm run package"), true);
  assert.equal(createdPackage.devDependencies["chips-sdk"], "^0.1.0");
  assert.equal(createdPackage.devDependencies.vitest, "^3.0.8");
  assert.equal(createdPackage.volta.extends, "../../package.json");

  const manifestText = await fsp.readFile(path.join(targetDir, "manifest.yaml"), "utf-8");
  assert.match(manifestText, /type:\s*module/);
  assert.match(manifestText, /entry:\s*dist\/index\.mjs/);
  assert.match(manifestText, /runtime:\s*\n\s*targets:/);
  assert.match(manifestText, /headless:\s*\n\s*supported:\s*true/);
  assert.match(manifestText, /module:\s*\n\s*apiVersion:\s*1/);
  assert.match(manifestText, /provides:/);
  assert.match(manifestText, /name:\s+run/);
  assert.match(manifestText, /name:\s+runAsync/);
  assert.match(manifestText, /mode:\s+sync/);
  assert.match(manifestText, /mode:\s+job/);
  assert.match(manifestText, /consumes:\s+\[\]/);
  assert.match(manifestText, /commandPath:\s+module-smoke run/);
  assert.match(manifestText, /commandPath:\s+module-smoke run-async/);
  assert.match(manifestText, /mapsTo:\s+sourceText/);
  assert.match(manifestText, /mapsTo:\s+delayMs/);
  assert.match(manifestText, /cancelOnInterrupt:\s+true/);

  const capabilityMatch = manifestText.match(/capability:\s*([^\n]+)/);
  assert.ok(capabilityMatch, "module capability should be declared in manifest");
  const moduleCapability = capabilityMatch[1].trim();
  const source = await fsp.readFile(path.join(targetDir, "src", "index.ts"), "utf-8");
  assert.match(source, /providers:/);
  assert.match(source, /reportProgress/);
  assert.match(source, /isCancelled/);
  assert.match(source, /MODULE_JOB_CANCELLED/);

  return { createdPackage, moduleCapability };
};

const assertPackagedArtifacts = async (targetDir, createdPackage) => {
  const entryPath = path.join(targetDir, "dist", "index.mjs");
  await fsp.access(entryPath);

  const packagePath = path.join(
    targetDir,
    "dist",
    `${createdPackage.name}-${createdPackage.version}.cpk`
  );
  await fsp.access(packagePath);

  const packageNames = (await fsp.readdir(path.join(targetDir, "dist"))).filter((name) => name.endsWith(".cpk"));
  assert.deepEqual(packageNames, [`${createdPackage.name}-${createdPackage.version}.cpk`]);
  return packagePath;
};

const pollJob = async (runtimeClient, jobId, expectedStatus) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const snapshot = await runtimeClient.invoke("module.job.get", { jobId });
    if (snapshot.job.status === expectedStatus) {
      return snapshot.job;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Module job ${jobId} did not reach ${expectedStatus}`);
};

const readErrorCode = (error) => {
  if (error && typeof error === "object" && typeof error.code === "string") {
    return error.code;
  }
  if (
    error &&
    typeof error === "object" &&
    error.details &&
    typeof error.details === "object" &&
    typeof error.details.code === "string"
  ) {
    return error.details.code;
  }
  return undefined;
};

const assertHostRuntime = async ({ targetDir, createdPackage, moduleCapability, packagePath }) => {
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

  const hostWorkspace = await fsp.mkdtemp(path.join(os.tmpdir(), "chips-module-scaffold-host-"));
  let app;

  try {
    const bootstrapRuntime = new PluginRuntime(hostWorkspace, {
      locale: "zh-CN",
      themeId: "chips-official.default-theme",
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
      enableRetry: true,
    });

    const installed = await runtimeClient.invoke("plugin.install", {
      manifestPath: packagePath,
    });
    assert.equal(installed.pluginId, createdPackage.name);
    await runtimeClient.invoke("plugin.enable", { pluginId: installed.pluginId });

    const providers = await runtimeClient.invoke("module.listProviders", {
      capability: moduleCapability,
    });
    assert.equal(
      providers.providers.some((provider) => provider.pluginId === createdPackage.name),
      true,
      "generated module should be visible in Host provider registry"
    );

    const resolved = await runtimeClient.invoke("module.resolve", {
      capability: moduleCapability,
      versionRange: "^1.0.0",
    });
    assert.equal(resolved.provider.pluginId, createdPackage.name);
    assert.equal(resolved.provider.capability, moduleCapability);

    const syncResult = await runtimeClient.invoke("module.invoke", {
      capability: moduleCapability,
      method: "run",
      input: {
        sourceText: "hello from scaffold",
        uppercase: true,
        prefix: "[host] ",
      },
    });
    assert.equal(syncResult.mode, "sync");
    assert.deepEqual(syncResult.output, {
      text: "[host] HELLO FROM SCAFFOLD",
      length: "[host] HELLO FROM SCAFFOLD".length,
      handledBy: createdPackage.name,
    });

    await assert.rejects(
      () =>
        runtimeClient.invoke("module.invoke", {
          capability: moduleCapability,
          method: "run",
          input: {
            sourceText: "invalid",
            unexpected: true,
          },
        }),
      (error) => readErrorCode(error) === "MODULE_SCHEMA_INVALID"
    );

    const started = await runtimeClient.invoke("module.invoke", {
      capability: moduleCapability,
      method: "runAsync",
      input: {
        sourceText: "async scaffold",
        delayMs: 1,
      },
    });
    assert.equal(started.mode, "job");

    const completedJob = await pollJob(runtimeClient, started.jobId, "completed");
    assert.deepEqual(completedJob.output, {
      text: "async scaffold",
      length: 14,
      handledBy: createdPackage.name,
    });

    const cancellable = await runtimeClient.invoke("module.invoke", {
      capability: moduleCapability,
      method: "runAsync",
      input: {
        sourceText: "cancel scaffold",
        delayMs: 1_000,
      },
    });
    assert.equal(cancellable.mode, "job");

    const cancelResult = await runtimeClient.invoke("module.job.cancel", { jobId: cancellable.jobId });
    assert.equal(cancelResult.ack, true);
    const cancelledJob = await pollJob(runtimeClient, cancellable.jobId, "cancelled");
    assert.equal(cancelledJob.error?.code, "MODULE_JOB_CANCELLED");

    const runtimeRecords = JSON.parse(
      await fsp.readFile(path.join(hostWorkspace, "plugin-runtime.json"), "utf-8")
    );
    assert.equal(
      runtimeRecords.some((record) => record.manifest?.id === createdPackage.name && record.enabled === true),
      true,
      "generated module .cpk should be installed and enabled in Host workspace"
    );

    await fsp.access(path.join(targetDir, "dist", "index.mjs"));
  } finally {
    if (app) {
      await app.stop();
    }
    await fsp.rm(hostWorkspace, { recursive: true, force: true });
  }
};

async function main() {
  console.log("Running chips-scaffold-module generated project e2e...");

  const sandboxRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "chips-module-scaffold-e2e-"));
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
            npm: "10.9.3",
          },
          workspaces: [
            "Chips-*",
            "Chips-BaseCardPlugin/*",
            "Chips-ComponentLibrary/packages/*",
            "Chips-ComponentLibrary/packages/adapters/*",
            "Chips-Scaffold/*",
            "ThemePack/*",
          ],
          overrides: TEST_NPM_OVERRIDES,
        },
        null,
        2
      ),
      "utf-8"
    );

    const env = withWritableNpmCache(
      {
        ...process.env,
        CHIPS_ECOSYSTEM_ROOT: sandboxRoot,
      },
      path.join(sandboxRoot, ".npm-cache")
    );

    const generated = new Map();
    for (const template of TEMPLATE_EXPECTATIONS) {
      const result = await createModuleProject(sandboxRoot, template, env);
      generated.set(template.id, result);
    }

    const standard = generated.get("module-standard");
    const { createdPackage, moduleCapability } = await assertDefaultProjectContract(
      sandboxRoot,
      standard.targetRelativePath,
      standard.targetDir
    );

    await run("npm", ["install"], sandboxRoot, env);
    await run("npm", ["run", "verify"], standard.targetDir, env);
    const packagePath = await assertPackagedArtifacts(standard.targetDir, createdPackage);
    await assertHostRuntime({
      targetDir: standard.targetDir,
      createdPackage,
      moduleCapability,
      packagePath,
    });

    console.log("E2E: 模块脚手架生成工程真实工作区与 Host 运行链路通过。");
  } finally {
    await fsp.rm(sandboxRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("E2E: 生成工程真实链路失败", error);
  process.exitCode = 1;
});
