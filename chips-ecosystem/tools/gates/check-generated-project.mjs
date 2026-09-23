import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import {
  addViolation,
  addWarning,
  existsDir,
  finalizeReport,
  isMainModule,
  makeReport,
  runGateCli,
  UsageError,
} from './lib/cli.mjs';
import { readText, toPosix, walkFiles } from './lib/walk.mjs';

/**
 * 生成工程门禁（G1）：覆盖矩阵点名的缺口收口——
 * 「脚手架生成 → 脚手架 validate → 可机检编译段 → 清洁度断言」的 CI 项。
 *
 * 权威承诺：《旧功能覆盖矩阵-Chips-Host-Chips-Scaffold-2026-09-20》§五 G1；
 * 旧实现参照：`Chips-Scaffold/chips-scaffold-<角色>/scripts/run-generated-e2e.{mjs,cjs}`（只读）。
 *
 * 设计要点：
 * - 从 `tools/scaffold/src` 现场转译装载生成器（不依赖 dist 新鲜度，与模板内容编辑解耦）；
 * - 判据全部取结构性判定（键集、文件集合、语法诊断、清洁度正则），不快照模板字面内容，
 *   与并发的模板演进（如 `cli.commands` 样例）互不踩踏；
 * - 重型真装真跑段（pnpm 沙箱 install + typecheck/build/test）挂显式开关
 *   `CHIPS_SCAFFOLD_E2E=1` 或 `--e2e`（比照宿主 app-smoke 的 `CHIPS_HOST_SMOKE=1` 惯例）；
 *   常跑段完整覆盖「生成→validate→可机检编译→清洁度」。
 */

const GATE_ID = 'generated-project';
const TITLE = '生成工程门禁（G1）';
const USAGE = `用法：node tools/gates/check-generated-project.mjs [选项]

对四角色模板各生成一份工程到临时沙箱，依次执行：脚手架自校验（validateManifest）、
manifest.yaml 落盘圆整校验（实形）、可机检编译段（语法级编译 + JSON/YAML 解析 +
本地引用存在性）、清洁度断言（占位回填、无 TODO、无裸路径直读、无身份泄露、文件集合齐备）。

选项：
  --workspace-root <dir>  工作区根目录（默认取配置文件上级两级）
  --config <file>         门禁配置文件（默认 tools/gates/gates.config.json）
  --report-dir <dir>      报告输出目录（默认配置 reports.dir）
  --e2e                   追加真装真跑臂（等价环境变量 CHIPS_SCAFFOLD_E2E=1）：
                          pnpm 沙箱 install 与逐工程 typecheck/build/test
  --keep-sandbox          保留临时沙箱目录（路径打印到 stderr，供排查）
  --json                  以 JSON 输出报告
  --no-report             不写入报告文件
  --help                  显示本帮助

退出码：0 通过；1 存在违规；2 用法或环境错误；3 工具内部错误。`;

/** 四角色的门禁样例插件 ID（命名空间前缀是清单协议常量，非模板字面）。 */
const ROLE_PLUGIN_IDS = Object.freeze({
  basecard: 'chips.basecard.gatecheck',
  boxlayout: 'chips.layout.gatecheck',
  app: 'chips.official.gatecheck',
  service: 'chips.service.gatecheck',
});

/** 每份生成工程必须落盘的核心文件（《02-插件清单规范》《插件包格式》协议面）。 */
const CORE_FILES = Object.freeze(['manifest.yaml', 'package.json', 'tsconfig.json', 'README.md']);

/** 旧脚手架身份与作废命令词（清洁度：模板身份不得泄露到正式工程）。 */
const LEGACY_IDENTITY_PATTERNS = Object.freeze([
  /app-standard/,
  /chips-scaffold-[a-z]+/,
  /\bchipsdev\b/,
]);

/** 未回填的模板占位符（大写标识符形式，与 JSX 内联对象字面量无碰撞）。 */
const TEMPLATE_PLACEHOLDER = /\{\{\s*[A-Z0-9_]+\s*\}\}/;

/** 未收口标记。 */
const UNCLEAN_MARKER = /\b(?:TODO|FIXME|XXX)\b/;

const TS_EXTENSIONS = new Set(['.ts', '.tsx']);
const JSON_EXTENSIONS = new Set(['.json']);

function listTsSources(srcDir) {
  return walkFiles(srcDir, { filter: (file) => file.endsWith('.ts') });
}

/** 把脚手架 src 目录下的全部 .ts 源文件现场转译为可加载的 ESM `.js`，返回可 import 的入口路径。 */
function compileScaffoldSources(scaffoldRoot, outDir) {
  const srcDir = path.join(scaffoldRoot, 'src');
  if (!existsDir(srcDir)) {
    throw new UsageError(`脚手架源码目录不存在：${srcDir}（无法执行生成工程门禁）`);
  }
  const sources = listTsSources(srcDir);
  if (sources.length === 0) {
    throw new UsageError(`脚手架源码目录为空：${srcDir}`);
  }
  for (const file of sources) {
    const code = readText(file);
    const { outputText, diagnostics } = ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      fileName: file,
    });
    if (diagnostics.length > 0) {
      throw new UsageError(
        `脚手架源码转译失败：${toPosix(path.relative(scaffoldRoot, file))}` +
          `（${diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('; ')}）`
      );
    }
    const rel = path.relative(srcDir, file).replace(/\.ts$/, '.js');
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, outputText, 'utf8');
  }
  return path.join(outDir, 'index.js');
}

/** 解析 `yaml` 包（脚手架 devDependency 实存）；不可用时返回 null 走内置子集解析器。 */
function resolveYamlParser(scaffoldRoot) {
  try {
    const requireFromScaffold = createRequire(path.join(scaffoldRoot, 'package.json'));
    const yamlEntry = requireFromScaffold.resolve('yaml');
    return import(pathToFileURL(yamlEntry).href).then(
      (module) => module.parse ?? module.default.parse
    );
  } catch {
    return null;
  }
}

/**
 * 内置子集解析器：只覆盖 `emitYaml` 输出文法（两级缩进块、`- ` 序列、`[]`/`{}`、
 * 行内标量与双引号转义）。用于 `yaml` 包不可解析的环境（如门禁单测夹具）。
 */
export function parseYamlSubset(text) {
  const lines = text
    .split('\n')
    .map((raw) => ({
      indent: (raw.match(/^ */) ?? [''])[0].length,
      text: raw.trimEnd().slice((raw.match(/^ */) ?? [''])[0].length),
    }))
    .filter((line) => line.text !== '');
  let cursor = 0;

  function parseScalar(token) {
    if (token === 'null') return null;
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token.startsWith('"')) {
      return JSON.parse(token);
    }
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(token)) {
      return Number(token);
    }
    return token;
  }

  function parseBlock(indent) {
    const first = lines[cursor];
    if (first === undefined || first.indent < indent) {
      return {};
    }
    if (first.text.startsWith('- ')) {
      return parseSequence(indent);
    }
    return parseMapping(indent);
  }

  function parseSequence(indent) {
    const items = [];
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (line.indent !== indent || !line.text.startsWith('-')) {
        break;
      }
      const inline = line.text.slice(1).trimStart();
      if (inline === '') {
        cursor += 1;
        items.push(parseBlock(indent + 2));
        continue;
      }
      const keyMatch = /^([^:]+):\s*(.*)$/.exec(inline);
      if (keyMatch && !inline.startsWith('"')) {
        const nested = {};
        const value = keyMatch[2];
        nested[keyMatch[1]] = value === '' ? undefined : parseScalar(value);
        cursor += 1;
        const child = parseBlock(indent + 2);
        Object.assign(nested, child);
        for (const [key, entry] of Object.entries(nested)) {
          if (entry === undefined && !(key in child)) {
            delete nested[key];
          }
        }
        items.push(nested);
        continue;
      }
      items.push(parseScalar(inline));
      cursor += 1;
    }
    return items;
  }

  function parseMapping(indent) {
    const mapping = {};
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (line.indent !== indent || line.text.startsWith('- ')) {
        break;
      }
      const match = /^([^:]+):(?:\s+(.*))?$/.exec(line.text);
      if (!match) {
        throw new UsageError(`内置 YAML 子集解析器无法解析行：${line.text}`);
      }
      const key = match[1];
      const inline = (match[2] ?? '').trim();
      if (inline === '[]' || inline === '{}') {
        mapping[key] = inline === '[]' ? [] : {};
        cursor += 1;
        continue;
      }
      if (inline !== '') {
        mapping[key] = parseScalar(inline);
        cursor += 1;
        continue;
      }
      cursor += 1;
      const next = lines[cursor];
      if (next !== undefined && next.indent > indent) {
        mapping[key] = parseBlock(next.indent);
      } else if (next !== undefined && next.indent === indent && next.text.startsWith('- ')) {
        mapping[key] = parseSequence(indent);
      } else {
        mapping[key] = {};
      }
    }
    return mapping;
  }

  return parseBlock(0);
}

/** 从生成源码中提取相对 import/require 指（含 from '/绝对路径' 的裸路径直读形态）。 */
function extractModuleRefs(source) {
  const refs = [];
  const pattern =
    /(?:^|\n|;|\})\s*(?:import|export)[\s\S]{0,400}?from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match = pattern.exec(source);
  while (match !== null) {
    refs.push(match[1] ?? match[2]);
    match = pattern.exec(source);
  }
  return refs;
}

/** 相对 import 的存在性判定（生成的工程内部一律无扩展名书写）。 */
function resolveRelativeRef(fileSet, fromPath, specifier) {
  const baseDir = path.posix.dirname(fromPath);
  const joined = path.posix.normalize(path.posix.join(baseDir, specifier));
  const candidates = [
    joined,
    `${joined}.ts`,
    `${joined}.tsx`,
    `${joined}/index.ts`,
    `${joined}/index.tsx`,
    joined.replace(/\.js$/, '.ts'),
    joined.replace(/\.js$/, '.tsx'),
  ];
  return candidates.some((candidate) => fileSet.has(candidate));
}

/** 单份生成工程文本产物的清洁度断言（占位、未收口、身份与沙箱路径泄露、裸路径直读）。 */
export function cleanlinessViolations({ projectLabel, files, sandboxRoot }) {
  const found = [];
  for (const file of files) {
    const label = `${projectLabel}/${file.path}`;
    if (TEMPLATE_PLACEHOLDER.test(file.content)) {
      found.push({ code: 'GP030', message: `存在未回填的模板占位符：${label}` });
    }
    if (UNCLEAN_MARKER.test(file.content)) {
      found.push({ code: 'GP031', message: `存在未收口标记（TODO/FIXME/XXX）：${label}` });
    }
    for (const pattern of LEGACY_IDENTITY_PATTERNS) {
      if (pattern.test(file.content)) {
        found.push({ code: 'GP032', message: `旧脚手架身份泄露（${pattern.source}）：${label}` });
      }
    }
    if (sandboxRoot !== '' && file.content.includes(sandboxRoot)) {
      found.push({ code: 'GP032', message: `沙箱绝对路径泄露到正式工程文本：${label}` });
    }
    if (
      TS_EXTENSIONS.has(path.extname(file.path)) ||
      file.path.endsWith('.mjs') ||
      file.path.endsWith('.cjs')
    ) {
      for (const ref of extractModuleRefs(file.content)) {
        if (/^\/(?!\/)/.test(ref) || /^[A-Za-z]:[\\/]/.test(ref)) {
          found.push({
            code: 'GP033',
            message: `生成源码存在绝对路径裸直读引用「${ref}」：${label}`,
          });
        }
      }
    }
  }
  return found;
}

/** 对单份生成工程执行除 e2e 外的全部机检段，返回违规与统计。 */
async function checkGeneratedProject({
  report,
  scaffoldModule,
  manifestValidate,
  role,
  projectDir,
  parseYaml,
}) {
  const violations = [];
  const { createScaffoldPlan } = scaffoldModule;
  const { validateManifest } = manifestValidate;
  const pluginId = ROLE_PLUGIN_IDS[role];
  const projectLabel = `gen/${role}`;
  const stats = { files: 0, tsChecked: 0, manifests: 0 };

  let plan;
  try {
    plan = createScaffoldPlan({ role, pluginId, name: '门禁样例', targetDir: projectLabel });
  } catch (error) {
    violations.push({
      code: 'GP001',
      message: `${projectLabel}：createScaffoldPlan 抛错（${error?.message ?? error}）`,
    });
    return { violations, stats };
  }

  // —— 脚手架 validate：内存 manifest 实形自校验 ——
  const memoryErrors = validateManifest(plan.manifest);
  stats.manifests += 1;
  for (const message of memoryErrors) {
    violations.push({
      code: 'GP010',
      message: `${projectLabel}：内存 manifest 校验失败：${message}`,
    });
  }

  // —— 关键文件齐备与落盘一致性 ——
  const planPaths = plan.files.map((file) => toPosix(file.path));
  const planSet = new Set(planPaths);
  const templateSet = new Set(plan.template.files.map((item) => toPosix(item)));
  for (const required of plan.template.files) {
    if (!planSet.has(toPosix(required))) {
      violations.push({
        code: 'GP040',
        message: `${projectLabel}：计划缺失模板声明文件：${required}`,
      });
    }
  }
  for (const extra of planSet) {
    if (!templateSet.has(extra)) {
      violations.push({
        code: 'GP040',
        message: `${projectLabel}：计划出现模板清单之外的文件：${extra}`,
      });
    }
  }
  for (const core of CORE_FILES) {
    if (!planSet.has(core)) {
      violations.push({ code: 'GP040', message: `${projectLabel}：核心文件缺失：${core}` });
    }
  }

  fs.mkdirSync(projectDir, { recursive: true });
  const written = [];
  for (const file of plan.files) {
    const dest = path.join(projectDir, file.path);
    if (file.content === '') {
      violations.push({
        code: 'GP040',
        message: `${projectLabel}：生成文件内容为空：${file.path}`,
      });
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.content, 'utf8');
    written.push({ path: toPosix(file.path), content: file.content });
  }
  stats.files = written.length;

  // —— manifest.yaml 落盘圆整校验（实形）——
  const manifestFile = written.find((file) => file.path === 'manifest.yaml');
  if (manifestFile) {
    let parsedManifest;
    try {
      parsedManifest = parseYaml(manifestFile.content);
    } catch (error) {
      violations.push({
        code: 'GP011',
        message: `${projectLabel}：manifest.yaml 解析失败：${error?.message ?? error}`,
      });
    }
    if (parsedManifest !== undefined && parsedManifest !== null) {
      stats.manifests += 1;
      for (const message of validateManifest(parsedManifest)) {
        violations.push({
          code: 'GP011',
          message: `${projectLabel}：manifest.yaml 实形校验失败：${message}`,
        });
      }
      const emittedKeys = new Set(Object.keys(parsedManifest));
      for (const key of Object.keys(plan.manifest)) {
        if (!emittedKeys.has(key)) {
          violations.push({
            code: 'GP012',
            message: `${projectLabel}：manifest.yaml 丢失顶层键：${key}（发射器与计划不一致）`,
          });
        }
      }
    }
  }

  // —— package.json 形状判定（协议约束，非模板字面）——
  const packageFile = written.find((file) => file.path === 'package.json');
  if (packageFile) {
    try {
      const parsedPackage = JSON.parse(packageFile.content);
      if (parsedPackage.version !== plan.manifest.version) {
        violations.push({
          code: 'GP013',
          message: `${projectLabel}：package.json version 与 manifest 不一致`,
        });
      }
      if ('dependencies' in parsedPackage) {
        violations.push({
          code: 'GP013',
          message: `${projectLabel}：package.json 出现 dependencies 键（平台提供物红线）`,
        });
      }
      for (const script of ['build', 'test']) {
        if (
          typeof parsedPackage.scripts?.[script] !== 'string' ||
          parsedPackage.scripts[script] === ''
        ) {
          violations.push({
            code: 'GP013',
            message: `${projectLabel}：package.json scripts.${script} 缺失或为空`,
          });
        }
      }
    } catch (error) {
      violations.push({
        code: 'GP013',
        message: `${projectLabel}：package.json 解析失败：${error?.message ?? error}`,
      });
    }
  }

  // —— 可机检编译段：语法级编译（parse 诊断） + JSON 解析 + 本地引用存在性 ——
  for (const file of written) {
    const ext = path.extname(file.path);
    if (TS_EXTENSIONS.has(ext)) {
      const sourceFile = ts.createSourceFile(
        path.join(projectDir, file.path),
        file.content,
        ts.ScriptTarget.ES2022,
        true,
        ext === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      const parseDiagnostics = sourceFile.parseDiagnostics ?? [];
      stats.tsChecked += 1;
      for (const diagnostic of parseDiagnostics) {
        violations.push({
          code: 'GP020',
          message:
            `${projectLabel}：语法级编译诊断：${file.path}` +
            `（${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}）`,
        });
      }
      for (const ref of extractModuleRefs(file.content)) {
        if (ref.startsWith('.')) {
          if (!resolveRelativeRef(planSet, file.path, ref)) {
            violations.push({
              code: 'GP022',
              message: `${projectLabel}：相对引用悬空：${file.path} → ${ref}`,
            });
          }
        }
      }
    } else if (JSON_EXTENSIONS.has(ext)) {
      try {
        JSON.parse(file.content);
      } catch (error) {
        violations.push({
          code: 'GP021',
          message: `${projectLabel}：JSON 产物解析失败：${file.path}（${error.message}）`,
        });
      }
    }
  }

  // —— 清洁度断言 ——
  violations.push(...cleanlinessViolations({ projectLabel, files: written, sandboxRoot: '' }));

  for (const violation of violations) {
    addViolation(report, violation.code, violation.message, { file: projectLabel });
  }
  return { violations, stats, plan, written };
}

/** 列举工作区内 `workspace:*` 依赖映射（名称 → 相对路径）。 */
function discoverWorkspaceMembers(workspaceRoot) {
  const found = [];
  for (const groupDir of ['packages', 'tools']) {
    const base = path.join(workspaceRoot, groupDir);
    if (!existsDir(base)) {
      continue;
    }
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const rel = `${groupDir}/${entry.name}`;
      const manifestPath = path.join(workspaceRoot, rel, 'package.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const pkg = JSON.parse(readText(manifestPath));
          if (pkg.name) {
            found.push([rel, pkg.name]);
          }
        } catch {
          // 非成员目录忽略
        }
      }
    }
  }
  return found;
}

/** e2e 开关臂：真沙箱 pnpm install + 逐工程 typecheck/build/test。 */
function runE2eArm({ report, workspaceRoot, sandboxRoot }) {
  const memberIndex = new Map(discoverWorkspaceMembers(workspaceRoot));
  const nameToRel = new Map([...memberIndex].map(([rel, name]) => [name, rel]));
  const seeds = ['sdk', 'ui', 'cli']
    .map((name) => `packages/${name}`)
    .filter((rel) => memberIndex.has(rel));
  const needed = new Set(seeds);
  const queue = [...seeds];
  while (queue.length > 0) {
    const rel = queue.shift();
    const manifestPath = path.join(workspaceRoot, rel, 'package.json');
    if (!fs.existsSync(manifestPath)) {
      continue;
    }
    const pkg = JSON.parse(readText(manifestPath));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const [depName, spec] of Object.entries(deps)) {
      if (spec !== 'workspace:*') {
        continue;
      }
      const depRel = nameToRel.get(depName);
      if (depRel !== undefined && !needed.has(depRel)) {
        needed.add(depRel);
        queue.push(depRel);
      }
    }
  }
  fs.mkdirSync(path.join(sandboxRoot, 'ws'), { recursive: true });
  for (const rel of needed) {
    const linkPath = path.join(sandboxRoot, 'ws', path.basename(rel));
    if (!fs.existsSync(linkPath)) {
      fs.symlinkSync(path.join(workspaceRoot, rel), linkPath, 'dir');
    }
  }
  fs.writeFileSync(
    path.join(sandboxRoot, 'package.json'),
    `${JSON.stringify({ name: 'chips-generated-project-e2e', private: true, version: '0.0.0' }, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(sandboxRoot, 'pnpm-workspace.yaml'),
    'packages:\n  - gen/*\n  - ws/*\n',
    'utf8'
  );
  const baseTsconfig = path.join(workspaceRoot, 'tsconfig.base.json');
  if (!fs.existsSync(baseTsconfig)) {
    addWarning(report, 'GP091', '工作区根缺少 tsconfig.base.json，e2e 段 typecheck 预期落空');
  } else {
    fs.copyFileSync(baseTsconfig, path.join(sandboxRoot, 'tsconfig.base.json'));
  }
  const runStep = (args, label, timeout) => {
    try {
      execFileSync('pnpm', args, {
        cwd: sandboxRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 32 * 1024 * 1024,
        timeout,
      });
      return null;
    } catch (error) {
      const tail = `${String(error.stdout ?? '')}\n${String(error.stderr ?? '')}`
        .trimEnd()
        .split('\n')
        .slice(-6)
        .join('\n');
      return `${label} 失败（exit ${error.status ?? error.signal}）：${tail}`;
    }
  };
  const failures = [];
  const installError = runStep(['install', '--ignore-scripts'], 'pnpm install', 600_000);
  if (installError !== null) {
    failures.push(installError);
  }
  if (installError === null) {
    for (const role of Object.keys(ROLE_PLUGIN_IDS)) {
      const projectDir = path.join(sandboxRoot, 'gen', role);
      if (!existsDir(projectDir)) {
        continue;
      }
      const pkg = JSON.parse(readText(path.join(projectDir, 'package.json')));
      for (const script of ['typecheck', 'build', 'test']) {
        if (!pkg.scripts?.[script]) {
          continue;
        }
        const error = runStep(
          ['--filter', pkg.name, 'run', script],
          `gen/${role} ${script}`,
          600_000
        );
        if (error !== null) {
          failures.push(error);
        }
      }
    }
  }
  for (const message of failures) {
    addViolation(report, 'GP050', `e2e 真跑段：${message}`);
  }
  return { projects: needed.size, failures: failures.length };
}

export async function runCheck({ workspaceRoot, flags }) {
  const report = makeReport(GATE_ID, TITLE);
  const scaffoldRoot = path.join(workspaceRoot, 'tools', 'scaffold');
  if (!existsDir(scaffoldRoot)) {
    throw new UsageError(`脚手架目录不存在：${scaffoldRoot}`);
  }
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chips-gates-generated-project-'));
  try {
    const compiledEntry = compileScaffoldSources(scaffoldRoot, path.join(sandboxRoot, 'scaffold'));
    const scaffoldModule = await import(pathToFileURL(compiledEntry).href);
    const manifestValidate = await import(
      pathToFileURL(path.join(path.dirname(compiledEntry), 'manifest-validate.js')).href
    );
    const yamlParsePromise = resolveYamlParser(scaffoldRoot);
    let parseYaml;
    if (yamlParsePromise) {
      parseYaml = await yamlParsePromise;
    } else {
      addWarning(
        report,
        'GP090',
        '无法解析 yaml 包（脚手架 devDependency），manifest 实形校验改用内置子集解析器'
      );
      parseYaml = parseYamlSubset;
    }
    const roles = Object.keys(ROLE_PLUGIN_IDS);
    const stats = { files: 0, tsChecked: 0, manifests: 0 };
    for (const role of roles) {
      const result = await checkGeneratedProject({
        report,
        scaffoldModule,
        manifestValidate,
        role,
        projectDir: path.join(sandboxRoot, 'gen', role),
        parseYaml,
      });
      stats.files += result.stats.files;
      stats.tsChecked += result.stats.tsChecked;
      stats.manifests += result.stats.manifests;
    }
    const e2eRequested = flags.get('e2e') === true || process.env.CHIPS_SCAFFOLD_E2E === '1';
    let e2e = { status: 'skipped' };
    if (e2eRequested) {
      const armStats = runE2eArm({ report, workspaceRoot, sandboxRoot });
      e2e = { status: armStats.failures === 0 ? 'passed' : 'failed', ...armStats };
    }
    if (flags.get('keep-sandbox') === true) {
      console.error(`[generated-project] 沙箱保留：${sandboxRoot}`);
    } else {
      fs.rmSync(sandboxRoot, { recursive: true, force: true });
    }
    return finalizeReport(report, {
      roles: roles.length,
      files: stats.files,
      tsChecked: stats.tsChecked,
      manifests: stats.manifests,
      e2e: e2e.status,
      parser: yamlParsePromise ? 'yaml' : 'subset',
    });
  } catch (error) {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
    if (error instanceof UsageError) {
      throw error;
    }
    throw new UsageError(`生成工程门禁执行失败：${error?.stack ?? error}`);
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  runGateCli({
    importMeta: import.meta.url,
    gateId: GATE_ID,
    title: TITLE,
    runCheck,
    usage: USAGE,
  }).then((code) => {
    process.exitCode = code;
  });
}
