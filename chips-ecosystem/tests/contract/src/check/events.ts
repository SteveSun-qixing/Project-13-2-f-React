/**
 * 事件表一致性检查（G8「事件契约」行）。
 *
 * 文档侧：保留域计数（05.02 §2.2）与逐事件契约（第四节各分册）；
 * 实现侧：`@chips/bridge` 的 `STANDARD_EVENTS`。
 *
 * 判定：事件 ID 集合逐项一致、可见性判定一致、逐域计数与文档声明一致、
 * `internal` 域不进入标准事件登记（不公开契约）。
 */

import type { BridgeCodeModel } from '../code/bridge.js';
import type { DocEventModel } from '../docs/events.js';
import { EVENT_ID_PATTERN } from '../docs/events.js';
import { diffSets, sortViolations, violation, type ContractViolation } from '../violations.js';

export interface EventCheckInput {
  readonly docs: DocEventModel;
  readonly code: BridgeCodeModel;
}

export function checkEvents(input: EventCheckInput): ContractViolation[] {
  const { docs, code } = input;
  const violations: ContractViolation[] = [];

  const docIds = docs.events.map((event) => event.id);
  const codeIds = code.events.map((event) => event.id);
  const diff = diffSets(docIds, codeIds);
  for (const id of diff.missing) {
    violations.push(
      violation('CONTRACT_EVENT_MISSING', id, '文档登记的标准事件未出现在 Bridge 事件登记表', {
        expected: 'STANDARD_EVENTS 包含该 ID',
        actual: '缺失',
      }),
    );
  }
  for (const id of diff.extra) {
    violations.push(
      violation('CONTRACT_EVENT_EXTRA', id, 'Bridge 登记了文档未登记的事件（禁止自造事件 ID）', {
        expected: '标准事件登记表包含该 ID',
        actual: '未登记',
      }),
    );
  }

  const codeById = new Map(code.events.map((event) => [event.id, event]));
  for (const event of docs.events) {
    if (event.visibilityKind === 'unknown') {
      violations.push(
        violation('CONTRACT_EVENT_VISIBILITY_UNKNOWN', event.id, '文档可见性表述无法归一为已知判定键', {
          actual: event.visibilityText,
        }),
      );
    }
    const codeEvent = codeById.get(event.id);
    if (codeEvent === undefined) {
      continue;
    }
    if (codeEvent.visibility !== event.visibilityKind) {
      violations.push(
        violation('CONTRACT_EVENT_VISIBILITY', event.id, '事件可见性与 Bridge 登记不一致', {
          expected: event.visibilityKind,
          actual: codeEvent.visibility,
        }),
      );
    }
  }

  const codeSeen = new Set<string>();
  for (const event of code.events) {
    if (!EVENT_ID_PATTERN.test(event.id)) {
      violations.push(
        violation('CONTRACT_EVENT_ID_GRAMMAR', event.id, 'Bridge 事件 ID 文法非法', {
          expected: '^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$',
        }),
      );
    }
    if (codeSeen.has(event.id)) {
      violations.push(violation('CONTRACT_EVENT_DUPLICATE', event.id, 'Bridge 事件登记表存在重复事件 ID'));
    }
    codeSeen.add(event.id);
  }

  const reservedDomains = new Map(docs.reservedDomains.map((entry) => [entry.domain, entry]));
  const counts = new Map<string, number>();
  for (const event of docs.events) {
    counts.set(event.domain, (counts.get(event.domain) ?? 0) + 1);
    if (reservedDomains.get(event.domain) === undefined) {
      violations.push(
        violation('CONTRACT_EVENT_DOMAIN_UNKNOWN', event.id, '标准事件使用了未在保留域表中的域名'),
      );
    }
    if (event.domain === 'internal') {
      violations.push(
        violation('CONTRACT_EVENT_INTERNAL_LEAK', event.id, '内核内部事件不得进入标准事件登记（不公开契约）'),
      );
    }
  }
  for (const reserved of docs.reservedDomains) {
    if (reserved.declaredCount === null) {
      continue;
    }
    const actual = counts.get(reserved.domain) ?? 0;
    if (actual !== reserved.declaredCount) {
      violations.push(
        violation(
          'CONTRACT_EVENT_DOMAIN_COUNT',
          reserved.domain,
          '保留域声明的事件数与实际声明数不一致',
          { expected: String(reserved.declaredCount), actual: String(actual) },
        ),
      );
    }
  }

  return sortViolations(violations);
}
