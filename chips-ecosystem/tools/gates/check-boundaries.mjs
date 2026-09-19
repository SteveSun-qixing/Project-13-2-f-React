import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import {
  addViolation,
  addWarning,
  finalizeReport,
  makeReport,
  runGateCli,
  readJsonFile,
  isMainModule,
} from './lib/cli.mjs';
import {
  classify,
  listDir,
  matchGlob,
  readText,
  toPosix,
  walkFiles,
  workspacePackages,
} from './lib/walk.mjs';

const GATE_ID = 'boundaries';
const TITLE = '架构边界门禁（G9）';
const USAGE = `用法：node tools/gates/check-boundaries.mjs [选项]

选项：
  --workspace-root <dir>  工作区根目录（默认取配置文件上级两级）
  --config <file>         门禁配置文件（默认 tools/gates/gates.config.json）
  --json                  以 JSON 输出报告
  --no-report             不写入报告文件
  --help                  显示本帮助`;

const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

function dependencySections(manifest) {
  return {
    dependencies: manifest.dependencies ?? {},
    peerDependencies: manifest.peerDependencies ?? {},
    optionalDependencies: manifest.optionalDependencies ?? {},
    devDependencies: manifest.devDependencies ?? {},
  };
}

function isInternal(name, scope) {
  return name.startsWith(scope);
}

function packageNameOf(specifier) {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split('/')[0];
}

function checkManifest(rules, report, pkg, scope, protocolPrefix, forbiddenProtocols, devAllowed) {
  const sections = dependencySections(pkg.json);
  const collected = [];
  for (const [section, deps] of Object.entries(sections)) {
    for (const [name, version] of Object.entries(deps)) {
      collected.push({ name, version: String(version), section });
    }
  }
  if (rules.kind === 'root') {
    for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(sections[section])) {
        addViolation(
          report,
          'BOUNDARY012',
          `根 package.json 禁止声明业务依赖：${section} → ${name}`,
          { file: 'package.json' }
        );
      }
    }
    return;
  }
  const allowed = new Set(rules.allowedInternal ?? []);
  for (const dep of collected) {
    if (!isInternal(dep.name, scope)) {
      continue;
    }
    if (!dep.version.startsWith(protocolPrefix)) {
      addViolation(
        report,
        'BOUNDARY011',
        `内部依赖必须使用 ${protocolPrefix}*：${dep.name}@${dep.version}`,
        {
          file: toPosix(path.join(pkg.relPath, 'package.json')),
        }
      );
    }
    if (dep.section === 'devDependencies' && devAllowed.has(dep.name)) {
      continue;
    }
    if (allowed.has(dep.name) || rules.allowAnyInternal) {
      continue;
    }
    addViolation(report, 'BOUNDARY010', `${rules.id} 禁止依赖 ${dep.name}（${dep.section}）`, {
      file: toPosix(path.join(pkg.relPath, 'package.json')),
    });
  }
  for (const dep of collected) {
    if (forbiddenProtocols.some((prefix) => dep.version.startsWith(prefix))) {
      addViolation(report, 'BOUNDARY011', `禁止的依赖协议：${dep.name}@${dep.version}`, {
        file: toPosix(path.join(pkg.relPath, 'package.json')),
      });
    }
  }
}

export function maskTemplateLiterals(text) {
  const output = [];
  const contexts = [{ type: 'code' }];
  let index = 0;
  const top = () => contexts[contexts.length - 1];
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (top().type === 'template') {
      if (char === '\\') {
        output.push(' ');
        output.push(next === '\n' ? '\n' : ' ');
        index += 2;
        continue;
      }
      if (char === '`') {
        output.push(' ');
        contexts.pop();
        index += 1;
        continue;
      }
      if (char === '$' && next === '{') {
        output.push(' ');
        output.push(' ');
        contexts.push({ type: 'code', brace: 1 });
        index += 2;
        continue;
      }
      output.push(char === '\n' ? '\n' : ' ');
      index += 1;
      continue;
    }
    const context = top();
    if (char === '`') {
      output.push(' ');
      contexts.push({ type: 'template' });
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      output.push(char);
      index += 1;
      while (index < text.length && text[index] !== quote) {
        if (text[index] === '\\') {
          output.push(text[index]);
          index += 1;
          if (index < text.length) {
            output.push(text[index]);
            index += 1;
          }
          continue;
        }
        output.push(text[index]);
        index += 1;
      }
      if (index < text.length) {
        output.push(quote);
        index += 1;
      }
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') {
        output.push(' ');
        index += 1;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      output.push(' ', ' ');
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) {
        output.push(text[index] === '\n' ? '\n' : ' ');
        index += 1;
      }
      if (index < text.length) {
        output.push(' ', ' ');
        index += 2;
      }
      continue;
    }
    if (context.brace !== undefined && char === '{') {
      context.brace += 1;
      output.push(char);
      index += 1;
      continue;
    }
    if (context.brace !== undefined && char === '}') {
      context.brace -= 1;
      if (context.brace === 0) {
        output.push(' ');
        contexts.pop();
      } else {
        output.push(char);
      }
      index += 1;
      continue;
    }
    output.push(char);
    index += 1;
  }
  return output.join('');
}

function extractImports(text) {
  const results = [];
  const lines = maskTemplateLiterals(text).split('\n');
  const startPattern = /^\s*(?:import|export)\b/;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const dynamic = /(?:^|[^.\w])(?:require|import)\s*\(\s*['"][^'"]+['"]\s*\)/.test(line);
    if (!startPattern.test(line) && !dynamic) {
      continue;
    }
    let chunk = line;
    let end = index;
    const complete = () =>
      /from\s*['"][^'"]+['"]/.test(chunk) ||
      /(?:require|import)\s*\(\s*['"][^'"]+['"]\s*\)/.test(chunk);
    while (!complete() && end < index + 10 && end + 1 < lines.length) {
      end += 1;
      chunk += `\n${lines[end]}`;
    }
    const typeOnly = /^\s*(?:import|export)\s+type\b/.test(chunk);
    const fromMatch = /from\s*['"]([^'"]+)['"]/.exec(chunk);
    const callMatch = /(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/.exec(chunk);
    const specifier = fromMatch ? fromMatch[1] : callMatch ? callMatch[1] : null;
    if (specifier) {
      results.push({ specifier, line: index + 1, typeOnly });
    }
    index = end;
  }
  return results;
}

function isTestFile(base, patterns) {
  return patterns.some((pattern) => new RegExp(pattern).test(base));
}

export function sourceFiles(pkgDir, config) {
  const ignored = new Set(
    config.ignoredDirs ?? [
      'node_modules',
      'dist',
      'coverage',
      'reports',
      'tests',
      '__tests__',
      'fixtures',
    ]
  );
  const extensions = config.sourceExtensions ?? ['.ts', '.tsx', '.js', '.mjs', '.cjs'];
  const patterns = config.testFilePatterns ?? ['\\.test\\.', '\\.spec\\.'];
  return walkFiles(pkgDir, {
    skipDirs: [...ignored],
    filter: (file) => {
      const base = path.basename(file);
      if (!extensions.some((extension) => base.endsWith(extension))) {
        return false;
      }
      if (base.endsWith('.d.ts')) {
        return false;
      }
      return !isTestFile(base, patterns);
    },
  });
}

function checkSource(report, pkg, rules, config, scope, devAllowed) {
  if (rules.kind === 'root') {
    return 0;
  }
  const files = sourceFiles(pkg.dir, config);
  const declared = new Set();
  for (const section of Object.values(dependencySections(pkg.json))) {
    for (const name of Object.keys(section)) {
      declared.add(name);
    }
  }
  const allowed = new Set(rules.allowedInternal ?? []);
  const typeOnly = new Set(rules.typeOnlyInternal ?? []);
  const forbidden = new Set(rules.forbiddenModules ?? []);
  let checked = 0;
  for (const file of files) {
    const rel = toPosix(path.relative(pkg.workspaceRoot ?? pkg.dir, file));
    const text = readText(file);
    const devContext = /\.config\.[cm]?[jt]s$/.test(path.basename(file));
    for (const entry of extractImports(text)) {
      checked += 1;
      const specifier = entry.specifier;
      const packageName = packageNameOf(specifier);
      if (forbidden.has(specifier) || forbidden.has(packageName)) {
        addViolation(report, 'BOUNDARY020', `源码导入了禁止模块：${specifier}`, {
          file: rel,
          line: entry.line,
        });
        continue;
      }
      if (rules.forbidNodeBuiltins && NODE_BUILTINS.has(specifier)) {
        addViolation(report, 'BOUNDARY020', `源码导入了禁止的 Node 内置模块：${specifier}`, {
          file: rel,
          line: entry.line,
        });
        continue;
      }
      if (!isInternal(specifier, scope)) {
        continue;
      }
      if (!declared.has(specifier) && !declared.has(packageName)) {
        addViolation(report, 'BOUNDARY021', `源码导入未声明的内部依赖：${specifier}`, {
          file: rel,
          line: entry.line,
        });
        continue;
      }
      if (
        !allowed.has(specifier) &&
        !allowed.has(packageName) &&
        !rules.allowAnyInternal &&
        !(devContext && devAllowed.has(packageName))
      ) {
        addViolation(report, 'BOUNDARY020', `${rules.id} 源码禁止导入：${specifier}`, {
          file: rel,
          line: entry.line,
        });
      }
      if ((typeOnly.has(specifier) || typeOnly.has(packageName)) && !entry.typeOnly) {
        addViolation(report, 'BOUNDARY022', `仅允许 import type：${specifier}`, {
          file: rel,
          line: entry.line,
        });
      }
    }
  }
  return checked;
}

function detectCycles(nodes, edges) {
  const cycles = [];
  const state = new Map();
  const stack = [];
  const visit = (node) => {
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      if (!nodes.has(next)) {
        continue;
      }
      if (state.get(next) === 'visiting') {
        const start = stack.indexOf(next);
        cycles.push([...stack.slice(start), next]);
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, 'done');
  };
  for (const node of nodes) {
    if (!state.has(node)) {
      visit(node);
    }
  }
  return cycles;
}

function checkRust(report, workspaceRoot, config) {
  const rust = config.rust ?? {};
  const manifestPath = path.resolve(workspaceRoot, rust.workspaceManifest ?? 'Cargo.toml');
  if (!fs.existsSync(manifestPath)) {
    addWarning(
      report,
      'BOUNDARY090',
      `未找到 Rust workspace 清单，跳过 Rust 依赖检查：${path.relative(workspaceRoot, manifestPath)}`
    );
    return { crates: 0 };
  }
  const manifest = readText(manifestPath);
  const membersMatch = /members\s*=\s*\[([\s\S]*?)\]/.exec(manifest);
  const members = membersMatch
    ? [...membersMatch[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1])
    : [];
  if (members.length === 0) {
    addWarning(report, 'BOUNDARY090', 'Cargo workspace 未声明成员，跳过 Rust 依赖检查');
    return { crates: 0 };
  }
  const allowedMap = rust.allowedDeps ?? {};
  const internalPrefix = rust.internalPrefix ?? 'chips-';
  const allCargo = walkFiles(workspaceRoot, {
    skipDirs: ['node_modules', '.git', 'target', 'dist', 'coverage', 'reports', 'fixtures'],
    filter: (file) => path.basename(file) === 'Cargo.toml',
  }).filter((file) => path.resolve(file) !== path.resolve(manifestPath));
  const memberDirs = [];
  for (const member of members) {
    if (member.includes('*')) {
      for (const manifestFile of allCargo) {
        const relDir = toPosix(path.relative(workspaceRoot, path.dirname(manifestFile)));
        if (matchGlob(member, relDir)) {
          memberDirs.push(relDir);
        }
      }
      continue;
    }
    const dir = toPosix(member);
    if (fs.existsSync(path.join(workspaceRoot, member, 'Cargo.toml'))) {
      memberDirs.push(dir);
      continue;
    }
    const cratesDir = path.join(workspaceRoot, member, 'crates');
    if (fs.existsSync(cratesDir)) {
      for (const entry of listDir(cratesDir)) {
        if (entry.isDirectory() && fs.existsSync(path.join(cratesDir, entry.name, 'Cargo.toml'))) {
          memberDirs.push(toPosix(path.join(member, 'crates', entry.name)));
        }
      }
      continue;
    }
    addViolation(report, 'BOUNDARY041', `Cargo workspace 成员缺少 Cargo.toml：${member}`, {
      file: 'Cargo.toml',
    });
  }
  const crates = new Map();
  for (const dir of [...new Set(memberDirs)].sort()) {
    const crateManifest = path.resolve(workspaceRoot, dir, 'Cargo.toml');
    const text = readText(crateManifest);
    const nameMatch = /^\s*name\s*=\s*["']([^"']+)["']/m.exec(text);
    const name = nameMatch ? nameMatch[1] : path.basename(dir);
    const deps = [];
    const depSection =
      /\[(?:dependencies|dev-dependencies|build-dependencies)\]([\s\S]*?)(?=\n\[|\s*$)/g;
    let sectionMatch = depSection.exec(text);
    while (sectionMatch !== null) {
      for (const line of sectionMatch[1].split('\n')) {
        const keyMatch = /^\s*([A-Za-z0-9_-]+)\s*=/.exec(line);
        if (keyMatch && keyMatch[1].startsWith(internalPrefix)) {
          deps.push(keyMatch[1]);
        }
      }
      sectionMatch = depSection.exec(text);
    }
    crates.set(name, { dir, deps: [...new Set(deps)] });
    if (allowedMap[name] === undefined) {
      addViolation(
        report,
        'BOUNDARY042',
        `未登记的 Rust crate：${name}（新增 crate 必须在门禁配置登记依赖允许集）`,
        {
          file: toPosix(path.join(dir, 'Cargo.toml')),
        }
      );
      continue;
    }
    const allowed = new Set(allowedMap[name]);
    for (const dep of crates.get(name).deps) {
      if (!allowed.has(dep)) {
        addViolation(report, 'BOUNDARY040', `Rust crate ${name} 禁止依赖 ${dep}`, {
          file: toPosix(path.join(dir, 'Cargo.toml')),
        });
      }
    }
  }
  const nodes = new Set(crates.keys());
  const edges = new Map([...crates].map(([name, crate]) => [name, crate.deps]));
  for (const cycle of detectCycles(nodes, edges)) {
    addViolation(report, 'BOUNDARY030', `Rust crate 循环依赖：${cycle.join(' → ')}`);
  }
  return { crates: crates.size };
}

export async function runCheck({ workspaceRoot, config }) {
  const report = makeReport(GATE_ID, TITLE);
  const boundaryConfig = config.boundaries ?? {};
  const scope = boundaryConfig.internalScope ?? '@chips/';
  const rules = boundaryConfig.rules ?? [];
  const devAllowed = new Set(boundaryConfig.allowedDevInternal ?? []);
  const packages = workspacePackages(workspaceRoot);
  const manifests = packages.filter((pkg) => pkg.relPath !== '.');
  const graphNodes = new Set();
  const graphEdges = new Map();
  let sourceImports = 0;
  for (const pkg of manifests) {
    const rule = classify(pkg.relPath, rules);
    if (!rule) {
      addViolation(report, 'BOUNDARY001', `工作区包未在门禁配置登记规则：${pkg.relPath}`, {
        file: toPosix(path.join(pkg.relPath, 'package.json')),
      });
      continue;
    }
    pkg.json = readJsonFile(pkg.manifest, `${pkg.relPath}/package.json`);
    pkg.workspaceRoot = workspaceRoot;
    checkManifest(
      rule,
      report,
      pkg,
      scope,
      boundaryConfig.workspaceProtocol ?? 'workspace:',
      boundaryConfig.forbiddenProtocolPrefixes ?? ['file:', 'link:'],
      devAllowed
    );
    sourceImports += checkSource(report, pkg, rule, boundaryConfig, scope, devAllowed);
    if (rule.kind !== 'root') {
      const name = pkg.json.name;
      if (typeof name === 'string' && name.length > 0) {
        graphNodes.add(name);
        const deps = Object.keys({
          ...(pkg.json.dependencies ?? {}),
          ...(pkg.json.peerDependencies ?? {}),
        }).filter((dep) => dep.startsWith(scope));
        graphEdges.set(name, deps);
      }
    }
  }
  const rootManifest = packages.find((pkg) => pkg.relPath === '.');
  if (rootManifest) {
    rootManifest.json = readJsonFile(rootManifest.manifest, '根 package.json');
    const rootRule = rules.find((rule) => rule.kind === 'root');
    if (rootRule) {
      checkManifest(
        rootRule,
        report,
        rootManifest,
        scope,
        boundaryConfig.workspaceProtocol ?? 'workspace:',
        boundaryConfig.forbiddenProtocolPrefixes ?? ['file:', 'link:'],
        devAllowed
      );
    } else {
      addViolation(report, 'BOUNDARY001', '门禁配置缺少根包规则（kind: root）', {
        file: 'package.json',
      });
    }
  }
  for (const cycle of detectCycles(graphNodes, graphEdges)) {
    addViolation(report, 'BOUNDARY030', `包循环依赖：${cycle.join(' → ')}`);
  }
  const rustStats = checkRust(report, workspaceRoot, boundaryConfig);
  return finalizeReport(report, {
    packages: manifests.length + (rootManifest ? 1 : 0),
    sourceImports,
    crates: rustStats.crates,
  });
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
