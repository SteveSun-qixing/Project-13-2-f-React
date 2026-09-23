import path from 'node:path';
import {
  EXIT,
  flagValue,
  isMainModule,
  parseArgv,
  printReport,
  readJsonFile,
  resolveWorkspaceRoot,
  scriptDir,
  UsageError,
  writeReportFile,
} from './lib/cli.mjs';
import { runCheck as runDocs } from './check-docs.mjs';
import { runCheck as runContracts } from './check-contracts.mjs';
import { runCheck as runBoundaries } from './check-boundaries.mjs';
import { runCheck as runCoverage } from './check-coverage.mjs';
import { runCheck as runGeneratedProject } from './check-generated-project.mjs';

const GATES = [
  { id: 'docs', title: '文档门禁（G12）', run: runDocs },
  { id: 'contracts', title: '契约一致性门禁（G8）', run: runContracts },
  { id: 'boundaries', title: '架构边界门禁（G9）', run: runBoundaries },
  { id: 'coverage', title: '覆盖率门禁（G6）', run: runCoverage },
  { id: 'generated-project', title: '生成工程门禁（G1）', run: runGeneratedProject },
];

const USAGE = `用法：node tools/gates/gates-all.mjs [选项]

选项：
  --workspace-root <dir>  工作区根目录（默认取配置文件上级两级）
  --config <file>         门禁配置文件（默认 tools/gates/gates.config.json）
  --only <a,b>            只执行指定门禁（docs,contracts,boundaries,coverage,generated-project）
  --json                  以 JSON 输出聚合报告
  --no-report             不写入报告文件
  --help                  显示本帮助

退出码：0 全部通过；1 任一失败；2 用法或配置错误；3 工具内部错误。`;

function selectGates(only) {
  if (!only) {
    return GATES;
  }
  const ids = String(only)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const unknown = ids.filter((id) => !GATES.some((gate) => gate.id === id));
  if (unknown.length > 0) {
    throw new UsageError(
      `未知门禁：${unknown.join(', ')}（可选：${GATES.map((gate) => gate.id).join(',')}）`
    );
  }
  return GATES.filter((gate) => ids.includes(gate.id));
}

async function main() {
  const argv = process.argv.slice(2);
  const { flags } = parseArgv(argv);
  if (flags.get('help') === true) {
    console.log(USAGE);
    return EXIT.PASS;
  }
  try {
    const ownDir = scriptDir(import.meta.url);
    const configFile = path.resolve(
      flagValue(flags, 'config', path.join(ownDir, 'gates.config.json'))
    );
    const config = readJsonFile(configFile, '门禁配置');
    const workspaceRoot = resolveWorkspaceRoot(
      configFile,
      config,
      flagValue(flags, 'workspace-root', undefined)
    );
    const selected = selectGates(flagValue(flags, 'only', undefined));
    const reports = [];
    for (const gate of selected) {
      const report = await gate.run({ workspaceRoot, config, configFile, flags });
      report.gate = gate.id;
      report.title = gate.title;
      reports.push(report);
    }
    const failed = reports.filter((report) => report.status === 'fail');
    const aggregate = {
      gate: 'gates',
      title: '全部门禁（gates:all）',
      status: failed.length === 0 ? 'pass' : 'fail',
      startedAt: reports[0]?.startedAt ?? new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      summary: Object.fromEntries(reports.map((report) => [report.gate, report.status])),
      violations: reports.flatMap((report) =>
        report.violations.map((item) => ({ gate: report.gate, ...item }))
      ),
      warnings: reports.flatMap((report) =>
        report.warnings.map((item) => ({ gate: report.gate, ...item }))
      ),
      gates: reports,
    };
    if (flags.get('json') === true) {
      console.log(JSON.stringify(aggregate, null, 2));
    } else {
      for (const report of reports) {
        printReport(report);
      }
      const verdict =
        aggregate.status === 'pass'
          ? '全部通过'
          : `${failed.map((report) => report.gate).join('、')} 失败`;
      console.log(
        `[gates] ${verdict}（${reports.length} 项门禁，违规 ${aggregate.violations.length} 条，警告 ${aggregate.warnings.length} 条）`
      );
    }
    const reportsDir = flagValue(
      flags,
      'report-dir',
      flagValue(flags, 'reports-dir', config.reports?.dir ?? 'reports')
    );
    if (flags.get('report') !== false) {
      try {
        const filePath = writeReportFile(workspaceRoot, reportsDir, 'gates', aggregate);
        if (flags.get('json') !== true) {
          console.log(`  报告：${path.relative(workspaceRoot, filePath)}`);
        }
      } catch (error) {
        console.error(`[gates] 报告写入失败：${error.message}`);
        return EXIT.ERROR;
      }
    }
    return aggregate.status === 'pass' ? EXIT.PASS : EXIT.FAIL;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`[gates] 配置或用法错误：${error.message}`);
      return EXIT.USAGE;
    }
    console.error(`[gates] 内部错误：${error?.stack ?? error}`);
    return EXIT.ERROR;
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main().then((code) => {
    process.exitCode = code;
  });
}
