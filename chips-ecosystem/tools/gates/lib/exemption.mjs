/**
 * 门禁豁免的机读消费（工单 017，《CI/CD 与质量门禁》§6.3）。
 *
 * 豁免登记唯一位置为《技术债务清单》，其中 `GATE-EXEMPTIONS-BEGIN/END` 标记块为
 * 机读镜像（§6.3 七要素逐条对应）；本模块只做「解析 + 匹配 + 期限判定」，
 * 不提供任何放宽阈值的通道：命中有效豁免只把违规转为留痕警告，数字照常呈现；
 * 过期、要素缺失、状态非 active 一律维持原失败判定（fail-closed）。
 */

import fs from 'node:fs';
import path from 'node:path';

const BLOCK_RE =
  /<!--\s*GATE-EXEMPTIONS-BEGIN\s*-->[\s\S]*?```json\s*\n([\s\S]*?)\n```[\s\S]*?<!--\s*GATE-EXEMPTIONS-END\s*-->/;

/** §6.3 七要素 + 门禁定位字段，全部必填（非空字符串；deadline 为 YYYY-MM-DD）。 */
const REQUIRED_FIELDS = [
  'id',
  'gate',
  'group',
  'metric',
  'deadline',
  'status',
  'approver',
  'reason',
  'scope',
  'evidence',
  'repaymentTask',
];

const DEADLINE_RE = /^\d{4}-\d{2}-\d{2}$/;

const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

/** 校验单条豁免登记；返回缺失/非法字段列表（空列表 = 要素齐全）。 */
function validateEntry(entry) {
  const problems = [];
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return ['条目不是对象'];
  }
  for (const field of REQUIRED_FIELDS) {
    const value = entry[field];
    if (!nonEmptyString(value)) {
      problems.push(`字段缺失或为空：${field}`);
    }
  }
  if (nonEmptyString(entry.deadline) && !DEADLINE_RE.test(entry.deadline)) {
    problems.push(`期限格式非法（应为 YYYY-MM-DD）：${entry.deadline}`);
  }
  return problems;
}

/**
 * 从登记文件解析豁免条目。
 *
 * 返回 `{ valid, invalid, notices }`：`notices` 为消费侧必须留痕的登记面问题
 * （文件缺失、块缺失、JSON 非法、条目要素缺失），全部按「不构成豁免」处理。
 */
export function loadGateExemptions({ workspaceRoot, registryPath, gateId }) {
  const notices = [];
  const invalid = [];
  const absPath = path.resolve(workspaceRoot, registryPath);
  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (error) {
    notices.push({
      code: 'COVERAGE031',
      message: `豁免登记文件不可读（按无豁免处理）：${path.relative(workspaceRoot, absPath)}（${error.message}）`,
    });
    return { valid: [], invalid, notices };
  }
  const block = BLOCK_RE.exec(raw);
  if (block === null) {
    notices.push({
      code: 'COVERAGE031',
      message: `豁免登记文件缺少 GATE-EXEMPTIONS 机读块（按无豁免处理）：${path.relative(workspaceRoot, absPath)}`,
    });
    return { valid: [], invalid, notices };
  }
  let parsed;
  try {
    parsed = JSON.parse(block[1]);
  } catch (error) {
    notices.push({
      code: 'COVERAGE031',
      message: `豁免机读块不是合法 JSON（按无豁免处理）：${error.message}`,
    });
    return { valid: [], invalid, notices };
  }
  const entries = Array.isArray(parsed?.exemptions) ? parsed.exemptions : null;
  if (entries === null) {
    notices.push({
      code: 'COVERAGE031',
      message: '豁免机读块缺少 exemptions 数组（按无豁免处理）',
    });
    return { valid: [], invalid, notices };
  }
  const valid = [];
  for (const entry of entries) {
    const label = nonEmptyString(entry?.id) ? entry.id : '(无编号)';
    if (entry !== null && typeof entry === 'object' && entry.gate !== gateId) {
      continue;
    }
    const problems = validateEntry(entry);
    if (problems.length > 0) {
      invalid.push({ entry, problems });
      notices.push({
        code: 'COVERAGE031',
        message: `豁免登记 ${label} 要素缺失（不构成豁免，判定维持失败）：${problems.join('；')}`,
      });
      continue;
    }
    valid.push(entry);
  }
  return { valid, invalid, notices };
}

/**
 * 对一个未达标判定做豁免匹配。
 *
 * 返回 `kind`：
 * - `active`：命中有效豁免（status=active 且未过期）→ 消费侧转留痕警告放行；
 * - `expired`：命中登记但已过期限 → 维持失败（§6.3 第 4 条）；
 * - `inactive`：命中登记但状态非 active（已清偿/已撤销）→ 维持失败；
 * - `none`：无对应登记 → 维持失败。
 */
export function matchExemption(ctx, group, metric, now = new Date()) {
  if (!ctx) {
    return { kind: 'none' };
  }
  const today = now.toISOString().slice(0, 10);
  let found = null;
  for (const entry of ctx.valid) {
    if (entry.group === group && entry.metric === metric) {
      found = entry;
      break;
    }
  }
  if (found === null) {
    return { kind: 'none' };
  }
  if (found.status !== 'active') {
    return { kind: 'inactive', entry: found };
  }
  if (today > found.deadline) {
    return { kind: 'expired', entry: found };
  }
  return { kind: 'active', entry: found };
}
