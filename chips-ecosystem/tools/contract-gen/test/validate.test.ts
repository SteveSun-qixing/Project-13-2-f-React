import { describe, expect, it } from 'vitest';

import { parseContract, type ParsedContract } from '../src/parse.js';
import { validateContract } from '../src/validate.js';
import { createMemoryReader, fixtureDocs, fixtureSources } from './fixtures.js';

const base = parseContract(createMemoryReader(fixtureDocs), fixtureSources);

function mutate(overrides: Partial<ParsedContract>): ParsedContract {
  return { ...base, ...overrides };
}

function rules(contract: ParsedContract): readonly string[] {
  return validateContract(contract).map((issue) => issue.rule);
}

describe('validateContract', () => {
  it('样例契约全部通过', () => {
    expect(validateContract(base)).toEqual([]);
  });

  it('能力与权限命名空间隔离（R3）', () => {
    const contract = mutate({
      permissions: [...base.permissions, { id: 'file:read' }],
    });
    expect(rules(contract)).toContain('namespace-isolation');
  });

  it('能力引用词表外权限', () => {
    const contract = mutate({
      capabilities: [
        ...base.capabilities,
        { id: 'file:write', permissions: ['filesystem:execute'] },
      ],
      facts: { ...base.facts, capabilityCount: base.facts.capabilityCount + 1 },
    });
    expect(rules(contract)).toContain('capability-permission-known');
  });

  it('能力计数与文档声明不一致', () => {
    const contract = mutate({ facts: { ...base.facts, capabilityCount: 99 } });
    expect(rules(contract)).toContain('capability-count');
  });

  it('权限未被域词表覆盖', () => {
    const contract = mutate({
      facts: {
        ...base.facts,
        permissionVocabulary: base.facts.permissionVocabulary.filter((id) => id !== 'command:read'),
      },
    });
    expect(rules(contract)).toContain('permission-vocabulary');
  });

  it('映射核对表引用 R19 外能力', () => {
    const contract = mutate({
      referenceCapabilities: [...base.referenceCapabilities, 'ghost:read'],
    });
    expect(rules(contract)).toContain('permission-mapping-capability-known');
  });

  it('事件数超出保留域声明', () => {
    const contract = mutate({
      events: [...base.events, { id: 'file:removed', domain: 'file' }],
    });
    expect(rules(contract)).toContain('event-count');
  });

  it('事件域不在保留域表', () => {
    const contract = mutate({
      events: [...base.events, { id: 'sync:progress', domain: 'sync' }],
    });
    expect(rules(contract)).toContain('event-domain-reserved');
  });

  it('事件进入不公开域', () => {
    const contract = mutate({
      facts: {
        ...base.facts,
        reservedDomains: [
          ...base.facts.reservedDomains,
          { domain: 'internal', declaredCount: null },
        ],
      },
      events: [...base.events, { id: 'internal:service', domain: 'internal' }],
    });
    expect(rules(contract)).toContain('event-domain-public');
  });

  it('常量名冲突', () => {
    const contract = mutate({
      capabilities: [...base.capabilities, { id: 'window:set-title', permissions: [] }],
      facts: { ...base.facts, capabilityCount: base.facts.capabilityCount + 1 },
    });
    expect(rules(contract)).toContain('name-capability');
  });

  it('错误码文法拦截', () => {
    const contract = mutate({ errorCodes: [{ code: 'broken_code' }] });
    expect(rules(contract)).toContain('id-error');
  });
});
