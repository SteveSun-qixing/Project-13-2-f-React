/**
 * 门禁豁免的机读消费（工单 017 落地、工单 027 收紧匹配粒度，《CI/CD 与质量门禁》§6.3）。
 *
 * 豁免登记唯一位置为《技术债务清单》，其中 `GATE-EXEMPTIONS-BEGIN/END` 标记块为
 * 机读镜像（§6.3 七要素逐条对应，schema `chips-gate-exemptions/v2`）；本模块只做
 * 「解析 + 组/维度匹配 + 期限判定」，不提供任何放宽阈值的通道：
 * 命中有效豁免只把违规转为留痕警告，数字照常呈现；
 * 过期、要素缺失、状态非 active 一律维持原失败判定（fail-closed）。
 *
 * 匹配粒度（工单 027）：每条登记必须携带 `scopePaths`（生效范围的仓库相对路径前缀集合，
 * 即七要素 `scope` 的机读形态，如具体 crate/包目录）；组内判定所需的逐成员归因
 * 由消费面（G6 `check-coverage.mjs`）依据本模块暴露的 `scopePaths` 完成——
 * 只放行由登记范围内成员造成的未达部分，组级聚合不再吞并未登记成员。
 */

import fs from 'node:fs';
import path from 'node:path';

const BLOCK_RE =
  /<!--\s*GATE-EXEMPTIONS-BEGIN\s*-->[\s\S]*?```json\s*\n([\s\S]*?)\n```[\s\S]*?<!--\s*GATE-EXEMPTIONS-END\s*-->/;

/** §6.3 七要素 + 门禁定位字段 + scope 机读字段，全部必填（非空字符串；deadline 为 YYYY-MM-DD）。 */
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
  'scopePaths',
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
    if (field === 'scopePaths') {
      continue;
    }
    const value = entry[field];
    if (!nonEmptyString(value)) {
      problems.push(`字段缺失或为空：${field}`);
    }
  }
  if (nonEmptyString(entry.deadline) && !DEADLINE_RE.test(entry.deadline)) {
    problems.push(`期限格式非法（应为 YYYY-MM-DD）：${entry.deadline}`);
  }
  // 工单 027：`scopePaths` 为 `scope` 承诺的机读形态，必须是非空路径前缀组成的数组；
  // 缺失或非法一律按「要素缺失」处理（fail-closed，不构成豁免）。
  if (!Array.isArray(entry.scopePaths) || entry.scopePaths.length === 0) {
    problems.push('字段缺失或为空：scopePaths（应为非空的仓库相对路径前缀数组）');
  } else if (entry.scopePaths.some((item) => !nonEmptyString(item))) {
    problems.push('scopePaths 含非字符串或空条目（应为非空的仓库相对路径前缀数组）');
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
 * 对一个未达标判定做豁免匹配（工单 027：返回同组同维度的全部命中，供消费面逐成员归因）。
 *
 * 返回 `{ entry, kind }[]`（按登记顺序），`kind`：
 * - `active`：有效豁免（status=active 且未过期）→ 消费侧还需按其 `scopePaths`
 *   完成成因归因才可放行（只放行登记范围内的未达部分）；
 * - `expired`：已过期限 → 维持失败（§6.3 第 4 条）；
 * - `inactive`：状态非 active（已清偿/已撤销）→ 维持失败。
 * 无命中返回空数组（维持失败）。
 */
export function matchExemptions(ctx, group, metric, now = new Date()) {
  const matches = [];
  if (!ctx) {
    return matches;
  }
  const today = now.toISOString().slice(0, 10);
  for (const entry of ctx.valid) {
    if (entry.group !== group || entry.metric !== metric) {
      continue;
    }
    if (entry.status !== 'active') {
      matches.push({ entry, kind: 'inactive' });
    } else if (today > entry.deadline) {
      matches.push({ entry, kind: 'expired' });
    } else {
      matches.push({ entry, kind: 'active' });
    }
  }
  return matches;
}

/**
 * 判定一个组内成员 id（仓库相对路径，如 crate/包目录）是否落在豁免登记的 `scopePaths` 范围内。
 *
 * 前缀匹配按路径段对齐：`packages/native` 覆盖 `packages/native` 本身与其下级
 * `packages/native/src`，不覆盖 `packages/native-x`（防子串搭便车）。
 */
export function coversScopeMember(scopePaths, memberId) {
  const member = path.posix.normalize(memberId);
  for (const raw of scopePaths) {
    const prefix = path.posix.normalize(raw.trim().replace(/\/+$/, ''));
    if (prefix.length === 0) {
      continue;
    }
    if (member === prefix || member.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}
