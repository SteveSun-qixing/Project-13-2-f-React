import fs from 'node:fs';
import path from 'node:path';
import {
  addViolation,
  addWarning,
  finalizeReport,
  makeReport,
  runGateCli,
  readJsonFile,
  flagValue,
  isMainModule,
} from './lib/cli.mjs';
import { readText, toPosix } from './lib/walk.mjs';
import { loadGateExemptions, matchExemption } from './lib/exemption.mjs';

const GATE_ID = 'coverage';
const TITLE = '覆盖率门禁（G6）';
const USAGE = `用法：node tools/gates/check-coverage.mjs [选项]

统计口径（《架构原则》4.1 与附录 R18、《测试规范》§一 与 §10.2、
《CI/CD 与质量门禁》3.2）：
  - TS：总体各维度 > defaultThreshold；coverage.groups 声明的共享层分组各自判定；
    TS 侧不存在 chips-* crate，因此不设 Rust 核心组（核心与共享层之外的代码并入总体）。
  - Rust：rust-overall（工作区总量，判 defaultThreshold）与 rust-core
    （coverage.rust.coreMatch 声明的 chips-* crate 统计面，判 coreThreshold）两条判定；
    Neon 绑定 crate chips-native（当前目录 packages/native/）按 crate 命名属于核心面，
    统计面不设豁免、不另计。配置未声明 coreMatch 时，核心面退化为工作区总量
    （当前 Rust workspace 成员全部为 chips-* crate）。
  - 判定唯一归属本门禁（工单 017）；@chips/testing 覆盖率面只做测量与报告。
  - 豁免：未达标分组按《CI/CD 与质量门禁》§6.3 咨询《技术债务清单》机读豁免登记
    （coverage.exemption.registry）：命中有效豁免 → COVERAGE030 留痕放行、数字照常呈现；
    过期/要素缺失/已清偿 → 维持 COVERAGE010 失败并出 COVERAGE031 警告。
    豁免不改变阈值、统计面与测量口径。

选项：
  --workspace-root <dir>  工作区根目录（默认取配置文件上级两级）
  --config <file>         门禁配置文件（默认 tools/gates/gates.config.json）
  --ts-report <file>      覆盖 TS 覆盖率 json-summary 路径
  --rust-report <file>    覆盖 Rust tarpaulin XML 路径
  --json                  以 JSON 输出报告
  --no-report             不写入报告文件
  --help                  显示本帮助`;

function emptyMetric() {
  return { total: 0, covered: 0 };
}

function addMetric(target, metric, entry) {
  const total = Number(entry?.total ?? 0);
  const covered = Number(entry?.covered ?? 0);
  target[metric].total += Number.isFinite(total) ? total : 0;
  target[metric].covered += Number.isFinite(covered) ? covered : 0;
}

function metricPct(value) {
  if (value.total <= 0) {
    return 100;
  }
  return (value.covered / value.total) * 100;
}

function classifyFile(filePath, groups) {
  const normalized = toPosix(filePath);
  for (const group of groups) {
    if (group.match.some((pattern) => normalized.includes(pattern))) {
      return group.id;
    }
  }
  return 'total';
}

function aggregateSummary(summary, metrics, groups) {
  const aggregates = new Map();
  const ensure = (id) => {
    if (!aggregates.has(id)) {
      const group = groups.find((item) => item.id === id);
      aggregates.set(id, {
        id,
        threshold: group ? group.threshold : null,
        metrics: Object.fromEntries(metrics.map((metric) => [metric, emptyMetric()])),
      });
    }
    return aggregates.get(id);
  };
  ensure('total');
  for (const group of groups) {
    ensure(group.id);
  }
  let files = 0;
  for (const [filePath, entry] of Object.entries(summary)) {
    if (filePath === 'total' || entry === null || typeof entry !== 'object') {
      continue;
    }
    files += 1;
    const groupId = classifyFile(filePath, groups);
    for (const metric of metrics) {
      if (entry[metric]) {
        addMetric(ensure('total').metrics, metric, entry[metric]);
        addMetric(ensure(groupId).metrics, metric, entry[metric]);
      }
    }
  }
  if (summary.total && typeof summary.total === 'object') {
    for (const metric of metrics) {
      if (summary.total[metric]) {
        const target = ensure('total').metrics[metric];
        target.total = Number(summary.total[metric].total ?? target.total);
        target.covered = Number(summary.total[metric].covered ?? target.covered);
      }
    }
  }
  return { aggregates: [...aggregates.values()], files };
}

/** 读取 XML 开标签上的 `key="value"` 属性对。 */
function readAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function parseTarpaulin(xml) {
  const root = /<coverage\b([^>]*)>/.exec(xml);
  if (!root) {
    return null;
  }
  const attributes = readAttributes(root[1]);
  const rate = (name) => {
    const value = Number(attributes[name]);
    return Number.isFinite(value) ? value : null;
  };
  const lineRate = rate('line-rate');
  const branchRate = rate('branch-rate');
  const branchValid = Number(attributes['branches-valid'] ?? 0);
  const metrics = {};
  if (lineRate !== null) {
    metrics.lines = {
      pct: lineRate * 100,
      covered: Number(attributes['lines-covered'] ?? 0),
      total: Number(attributes['lines-valid'] ?? 0),
    };
  }
  if (branchRate !== null && branchValid > 0) {
    metrics.branches = {
      pct: branchRate * 100,
      covered: Number(attributes['branches-covered'] ?? 0),
      total: branchValid,
    };
  }
  return metrics;
}

/**
 * 解析 Cobertura 报告里的逐文件行数据（cargo-tarpaulin 的 class 条目）。
 *
 * `filename` 为仓库相对路径；每个 `<line hits="n">` 即一条可统计行，`hits > 0` 计为已覆盖。
 * tarpaulin 不输出函数/语句维度、也不输出逐文件分支计数，因此核心面只能按行判定。
 */
function parseTarpaulinClasses(xml) {
  const classes = [];
  for (const match of xml.matchAll(/<class\b([^>]*)>([\s\S]*?)<\/class>/g)) {
    const filename = toPosix(readAttributes(match[1]).filename ?? '');
    if (!filename) {
      continue;
    }
    let covered = 0;
    let total = 0;
    for (const line of match[2].matchAll(/<line\b[^>]*\bhits="(\d+)"/g)) {
      total += 1;
      if (Number(line[1]) > 0) {
        covered += 1;
      }
    }
    classes.push({ filename, covered, total });
  }
  return classes;
}

/** 按核心面路径前缀聚合逐文件行数据；核心面内无行时返回 `null`。 */
function aggregateCoreLines(classes, coreMatch) {
  let covered = 0;
  let total = 0;
  for (const item of classes) {
    if (coreMatch.some((prefix) => item.filename.startsWith(toPosix(prefix)))) {
      covered += item.covered;
      total += item.total;
    }
  }
  if (total <= 0) {
    return null;
  }
  return { lines: { pct: (covered / total) * 100, covered, total } };
}

function judgeGroup(report, group, threshold, metrics, exemptionCtx, now) {
  const result = { id: group, threshold, metrics: {}, pass: true, exempted: [] };
  for (const [metric, value] of Object.entries(metrics)) {
    const pct = value.pct ?? metricPct(value);
    let pass = pct > threshold;
    const metricResult = {
      pct: Number(pct.toFixed(2)),
      covered: value.covered,
      total: value.total,
      threshold,
      pass,
    };
    if (!pass) {
      const matched = matchExemption(exemptionCtx, group, metric, now);
      if (matched.kind === 'active') {
        metricResult.exemption = {
          id: matched.entry.id,
          deadline: matched.entry.deadline,
          approver: matched.entry.approver,
        };
        result.exempted.push(matched.entry.id);
        pass = true;
        addWarning(
          report,
          'COVERAGE030',
          `${group} 覆盖率 ${metric} ${pct.toFixed(2)}% 未达标（要求 > ${threshold}%），` +
            `依《CI/CD 与质量门禁》§6.3 豁免 ${matched.entry.id} 留痕放行` +
            `（期限至 ${matched.entry.deadline}，数字照常呈现，到期未清偿自动失效）`
        );
      } else if (matched.kind === 'expired') {
        addWarning(
          report,
          'COVERAGE031',
          `豁免 ${matched.entry.id} 期限已过（${matched.entry.deadline}），按 §6.3 第 4 条维持失败`
        );
      } else if (matched.kind === 'inactive') {
        addWarning(
          report,
          'COVERAGE031',
          `豁免 ${matched.entry.id} 状态为 ${matched.entry.status}（非 active），不构成豁免`
        );
      }
    }
    metricResult.pass = pass;
    result.metrics[metric] = metricResult;
    if (!pass) {
      result.pass = false;
      addViolation(
        report,
        'COVERAGE010',
        `${group} 覆盖率 ${metric} ${pct.toFixed(2)}% 未达标（要求 > ${threshold}%）`
      );
    }
  }
  if (result.exempted.length === 0) {
    delete result.exempted;
  }
  return result;
}

export async function runCheck({ workspaceRoot, config, flags, now = new Date() }) {
  const report = makeReport(GATE_ID, TITLE);
  const coverage = config.coverage ?? {};
  const inputs = coverage.inputs ?? {};
  const metrics = coverage.metrics ?? ['lines', 'functions', 'branches', 'statements'];
  const defaultThreshold = coverage.defaultThreshold ?? 80;
  const groups = (coverage.groups ?? []).map((group) => ({
    ...group,
    threshold: group.threshold ?? defaultThreshold,
  }));

  // 豁免消费挂点（§6.3 / 工单 017）：仅咨询登记，不改变阈值、统计面与测量口径；
  // 登记不可读/缺块/要素缺失一律按无豁免处理（fail-closed），并以 COVERAGE031 留痕。
  let exemptionCtx = null;
  const exemptionConfig = coverage.exemption;
  if (exemptionConfig?.registry) {
    exemptionCtx = loadGateExemptions({
      workspaceRoot,
      registryPath: exemptionConfig.registry,
      gateId: exemptionConfig.gateId ?? 'G6',
    });
    for (const notice of exemptionCtx.notices) {
      addWarning(report, notice.code, notice.message);
    }
  }
  const judge = (group, threshold, groupMetrics) =>
    judgeGroup(report, group, threshold, groupMetrics, exemptionCtx, now);
  const summaryPath = path.resolve(
    workspaceRoot,
    flagValue(flags, 'ts-report', inputs.ts?.path ?? 'coverage/coverage-summary.json')
  );
  const rustPath = path.resolve(
    workspaceRoot,
    flagValue(flags, 'rust-report', inputs.rust?.path ?? 'coverage/tarpaulin.xml')
  );

  const results = [];
  let tsFiles = 0;
  if (!fs.existsSync(summaryPath)) {
    if (inputs.ts?.required !== false) {
      addViolation(
        report,
        'COVERAGE001',
        `覆盖率报告缺失：${path.relative(workspaceRoot, summaryPath)}（先执行 pnpm test:coverage）`
      );
    }
  } else {
    let summary;
    try {
      summary = readJsonFile(summaryPath, 'TS 覆盖率报告');
    } catch (error) {
      addViolation(report, 'COVERAGE002', error.message);
    }
    if (
      summary !== undefined &&
      (summary === null || typeof summary !== 'object' || Array.isArray(summary))
    ) {
      addViolation(
        report,
        'COVERAGE002',
        `TS 覆盖率报告结构非法（应为 json-summary 对象）：${path.relative(workspaceRoot, summaryPath)}`
      );
      summary = undefined;
    }
    if (summary) {
      const { aggregates, files } = aggregateSummary(summary, metrics, groups);
      tsFiles = files;
      if (files === 0) {
        addViolation(report, 'COVERAGE020', 'TS 覆盖率报告不含任何文件条目');
      }
      const requiredIds = new Set(
        groups.filter((group) => group.required).map((group) => group.id)
      );
      requiredIds.add('total');
      for (const aggregate of aggregates) {
        const hasData = Object.values(aggregate.metrics).some((value) => value.total > 0);
        const threshold = aggregate.threshold ?? defaultThreshold;
        if (!hasData) {
          if (requiredIds.has(aggregate.id)) {
            addViolation(report, 'COVERAGE011', `覆盖率报告缺少必需组数据：${aggregate.id}`);
          } else {
            addWarning(report, 'COVERAGE090', `覆盖率报告缺少可选组数据：${aggregate.id}`);
          }
          results.push({ id: aggregate.id, threshold, skipped: true, pass: true });
          continue;
        }
        results.push(judge(aggregate.id, threshold, aggregate.metrics));
      }
    }
  }

  // Rust 侧两条判定（《架构原则》4.1：Rust 总体 > 80% 且 chips-* 核心 > 90%）。
  // 核心阈值缺省取 R18 的 90，不取 defaultThreshold，避免配置缺项时隐性放宽核心面。
  const rustConfig = coverage.rust ?? {};
  const rustCoreThreshold = rustConfig.coreThreshold ?? 90;
  const rustCoreMatch = rustConfig.coreMatch ?? [];
  if (!fs.existsSync(rustPath)) {
    if (inputs.rust?.required !== false) {
      addViolation(
        report,
        'COVERAGE001',
        `覆盖率报告缺失：${path.relative(workspaceRoot, rustPath)}（先执行 cargo tarpaulin --out Xml）`
      );
    }
  } else {
    const rustXml = readText(rustPath);
    const rustMetrics = parseTarpaulin(rustXml);
    if (rustMetrics === null) {
      addViolation(
        report,
        'COVERAGE002',
        `Rust 覆盖率报告格式非法：${path.relative(workspaceRoot, rustPath)}`
      );
    } else {
      results.push(judge('rust-overall', defaultThreshold, rustMetrics));
      const coreMetrics =
        rustCoreMatch.length > 0
          ? aggregateCoreLines(parseTarpaulinClasses(rustXml), rustCoreMatch)
          : rustMetrics;
      if (coreMetrics === null) {
        addViolation(
          report,
          'COVERAGE011',
          `覆盖率报告缺少必需组数据：rust-core（coreMatch ${rustCoreMatch.join('、')} 内无行条目）`
        );
        results.push({ id: 'rust-core', threshold: rustCoreThreshold, skipped: true, pass: true });
      } else {
        results.push(judge('rust-core', rustCoreThreshold, coreMetrics));
      }
    }
  }

  return finalizeReport(report, {
    tsFiles,
    groups: results
      .map(
        (group) =>
          `${group.id}=${group.pass ? 'pass' : 'fail'}${
            group.exempted ? `(${group.exempted.join('+')})` : ''
          }`
      )
      .join(' '),
    // 结构化判定明细：@chips/testing 覆盖率面据此渲染人读报告（工单 017 委托链）。
    coverage: results,
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
