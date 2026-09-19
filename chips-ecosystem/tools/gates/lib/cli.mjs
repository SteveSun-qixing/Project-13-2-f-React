import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, USAGE: 2, ERROR: 3 });

export class UsageError extends Error {}

export function parseArgv(argv) {
  const flags = new Map();
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const equals = body.indexOf('=');
    if (equals >= 0) {
      flags.set(body.slice(0, equals), body.slice(equals + 1));
      continue;
    }
    if (body.startsWith('no-')) {
      flags.set(body.slice(3), false);
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(body, next);
      index += 1;
    } else {
      flags.set(body, true);
    }
  }
  return { flags, positionals };
}

export function flagValue(flags, name, fallback) {
  const value = flags.get(name);
  return value === undefined ? fallback : value;
}

export function readJsonFile(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new UsageError(`${label} 不存在或不可读：${filePath}（${error.message}）`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new UsageError(`${label} 不是合法 JSON：${filePath}（${error.message}）`);
  }
}

export function existsDir(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

export function resolveWorkspaceRoot(configFile, config, override) {
  if (override) {
    return path.resolve(override);
  }
  const base = config.workspaceRoot
    ? path.resolve(path.dirname(configFile), config.workspaceRoot)
    : path.resolve(path.dirname(configFile), '..', '..');
  return base;
}

export function isMainModule(importMetaUrl, argv1) {
  if (!argv1) {
    return false;
  }
  return pathToFileURL(path.resolve(argv1)).href === importMetaUrl;
}

export function scriptDir(importMetaUrl) {
  return path.dirname(fileURLToPath(importMetaUrl));
}

function formatViolation(item, index) {
  const location = item.file ? ` ${item.file}${item.line ? `:${item.line}` : ''}` : '';
  return `  ${index + 1}. [${item.code}]${location} ${item.message}`;
}

export function printReport(report, { maxViolations = 50 } = {}) {
  const head = report.status === 'pass' ? '通过' : '失败';
  console.log(`[${report.gate}] ${report.title}：${head}`);
  const summary = report.summary || {};
  const summaryText = Object.entries(summary)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.length : value}`)
    .join(' ');
  if (summaryText) {
    console.log(`  统计：${summaryText}`);
  }
  report.violations.forEach((item, index) => {
    if (index < maxViolations) {
      console.log(formatViolation(item, index));
    }
  });
  if (report.violations.length > maxViolations) {
    console.log(`  ... 其余 ${report.violations.length - maxViolations} 条见 JSON 报告`);
  }
  if (report.warnings.length > 0) {
    console.log(`  警告 ${report.warnings.length} 条：`);
    report.warnings
      .slice(0, 20)
      .forEach((item) => console.log(`  - [${item.code}] ${item.message}`));
    if (report.warnings.length > 20) {
      console.log(`  ... 其余 ${report.warnings.length - 20} 条警告见 JSON 报告`);
    }
  }
}

export function writeReportFile(
  workspaceRoot,
  reportsDir,
  gateId,
  report,
  fileName = `${gateId}.json`
) {
  const dir = path.resolve(workspaceRoot, reportsDir, gateId);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return filePath;
}

export async function runGateCli({ importMeta, gateId, title, runCheck, usage }) {
  const argv = process.argv.slice(2);
  const { flags } = parseArgv(argv);
  if (flags.get('help') === true) {
    console.log(usage);
    return EXIT.PASS;
  }
  try {
    const ownDir = scriptDir(importMeta);
    const configFile = path.resolve(
      flagValue(flags, 'config', path.join(ownDir, 'gates.config.json'))
    );
    const config = readJsonFile(configFile, '门禁配置');
    const workspaceRoot = resolveWorkspaceRoot(
      configFile,
      config,
      flagValue(flags, 'workspace-root', undefined)
    );
    if (!existsDir(workspaceRoot)) {
      throw new UsageError(`工作区根目录不存在：${workspaceRoot}`);
    }
    const report = await runCheck({ workspaceRoot, config, configFile, flags });
    report.gate = gateId;
    report.title = title;
    const reportsDir = flagValue(
      flags,
      'report-dir',
      flagValue(flags, 'reports-dir', config.reports?.dir ?? 'reports')
    );
    const asJson = flags.get('json') === true;
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }
    if (flags.get('report') !== false) {
      try {
        const filePath = writeReportFile(workspaceRoot, reportsDir, gateId, report);
        if (!asJson) {
          console.log(`  报告：${path.relative(workspaceRoot, filePath)}`);
        }
      } catch (error) {
        console.error(`[${gateId}] 报告写入失败：${error.message}`);
        return EXIT.ERROR;
      }
    }
    return report.status === 'pass' ? EXIT.PASS : EXIT.FAIL;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`[${gateId}] 配置或用法错误：${error.message}`);
      return EXIT.USAGE;
    }
    console.error(`[${gateId}] 内部错误：${error?.stack ?? error}`);
    return EXIT.ERROR;
  }
}

export function makeReport(gateId, title) {
  return {
    gate: gateId,
    title,
    status: 'pass',
    startedAt: new Date().toISOString(),
    finishedAt: '',
    summary: {},
    violations: [],
    warnings: [],
  };
}

export function addViolation(report, code, message, extra = {}) {
  report.violations.push({ code, message, ...extra });
}

export function addWarning(report, code, message, extra = {}) {
  report.warnings.push({ code, message, ...extra });
}

export function finalizeReport(report, summary = {}) {
  report.summary = { ...report.summary, ...summary };
  report.status = report.violations.length === 0 ? 'pass' : 'fail';
  report.finishedAt = new Date().toISOString();
  return report;
}
