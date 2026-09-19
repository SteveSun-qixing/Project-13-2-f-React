import fs from 'node:fs';
import path from 'node:path';
import {
  EXIT,
  addViolation,
  finalizeReport,
  flagValue,
  isMainModule,
  makeReport,
  parseArgv,
  printReport,
  writeReportFile,
} from './lib/cli.mjs';

const GATE_ID = 'entries';
const TITLE = '插件入口校验（构建与打包 §5.6）';
const VENDOR_PREFIX = 'chips-resource://platform/vendor/';
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const SPECIFIER_PATTERN =
  /(?:^|\n)\s*(?:import|export)\s[^'"\n]*['"]([^'"\n]+)['"]|\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;

const USAGE = `用法：node tools/gates/check-entries.mjs [插件目录] [选项]

选项：
  --max-bytes <n>   单入口字节上限（默认 8388608，即 8 MiB）
  --report-dir <d>  报告输出目录（默认 reports）
  --json            以 JSON 输出报告
  --no-report       不写入报告文件
  --help            显示本帮助

判定（构建与打包 §5.6）：
  - dist/index.js 与 render.js 必须存在、为 UTF-8 文本且不超过入口上限；
  - dist/index.js 不得含任何模块引用（完全自包含）；
  - render.js 只允许 ${VENDOR_PREFIX} 绝对 URL。

退出码：0 通过；1 校验失败；2 用法错误；3 工具内部错误。`;

function collectSpecifiers(source) {
  const specifiers = [];
  SPECIFIER_PATTERN.lastIndex = 0;
  let match = SPECIFIER_PATTERN.exec(source);
  while (match !== null) {
    specifiers.push(match[1] ?? match[2]);
    match = SPECIFIER_PATTERN.exec(source);
  }
  return specifiers;
}

function checkEntry(report, file, relative, isRenderEntry, maxBytes) {
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    addViolation(
      report,
      'ENTRY001',
      `缺少入口文件或不可读：${relative}（${error.code ?? error.message}）`
    );
    return 0;
  }
  if (bytes.length > maxBytes) {
    addViolation(
      report,
      'ENTRY002',
      `入口超过上限：${relative} ${bytes.length} 字节 > ${maxBytes} 字节`
    );
  }
  if (bytes.includes(0)) {
    addViolation(report, 'ENTRY003', `入口不是 UTF-8 文本：${relative}`);
    return 0;
  }
  const specifiers = collectSpecifiers(bytes.toString('utf8'));
  for (const specifier of specifiers) {
    const allowed = isRenderEntry && specifier.startsWith(VENDOR_PREFIX);
    if (!allowed) {
      addViolation(report, 'ENTRY010', `${relative} 含非法模块引用：${specifier}`);
    }
  }
  return specifiers.length;
}

export async function runCheck({ pluginDir, maxBytes = DEFAULT_MAX_BYTES }) {
  const report = makeReport(GATE_ID, TITLE);
  const mainEntry = path.join(pluginDir, 'dist', 'index.js');
  const renderEntry = path.join(pluginDir, 'render.js');
  const mainSpecifiers = checkEntry(report, mainEntry, 'dist/index.js', false, maxBytes);
  const renderSpecifiers = checkEntry(report, renderEntry, 'render.js', true, maxBytes);
  return finalizeReport(report, {
    pluginDir,
    maxBytes,
    mainSpecifiers,
    renderSpecifiers,
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const { flags, positionals } = parseArgv(argv);
  if (flags.get('help') === true) {
    console.log(USAGE);
    return EXIT.PASS;
  }
  const pluginDir = path.resolve(positionals[0] ?? process.cwd());
  const maxBytes = Number(flagValue(flags, 'max-bytes', DEFAULT_MAX_BYTES));
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    console.error(`[${GATE_ID}] 用法错误：--max-bytes 必须为正整数`);
    return EXIT.USAGE;
  }
  try {
    const report = await runCheck({ pluginDir, maxBytes });
    if (flags.get('json') === true) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }
    if (flags.get('report') !== false) {
      const reportsDir = flagValue(flags, 'report-dir', 'reports');
      try {
        const filePath = writeReportFile(pluginDir, reportsDir, GATE_ID, report);
        if (flags.get('json') !== true) {
          console.log(`  报告：${path.relative(pluginDir, filePath)}`);
        }
      } catch (error) {
        console.error(`[${GATE_ID}] 报告写入失败：${error.message}`);
        return EXIT.ERROR;
      }
    }
    return report.status === 'pass' ? EXIT.PASS : EXIT.FAIL;
  } catch (error) {
    console.error(`[${GATE_ID}] 内部错误：${error?.stack ?? error}`);
    return EXIT.ERROR;
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main().then((code) => {
    process.exitCode = code;
  });
}
