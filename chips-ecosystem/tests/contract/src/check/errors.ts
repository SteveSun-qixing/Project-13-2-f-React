/**
 * 错误码表一致性检查（G8「错误码」相关判定 + 红线 11「不得自造错误码」）。
 *
 * - 拥有完整实现域的登记表（Bridge 通道、事件、资源协议）：集合逐项一致；
 * - 部分实现域（权限拒绝、权限登记内核常量、Bridge 资源控制、PAL）：实现侧必须是对应文档域的
 *   子集（内核生命周期常量对照 01-薯片内核设计 §九 码表）；
 * - 实现侧任何登记错误码都必须在文档错误码注册表内；
 * - Bridge 通道错误码的 `retryable` 与文档表逐项一致。
 */

import type { BridgeCodeModel } from '../code/bridge.js';
import type { HostCodeModel } from '../code/host.js';
import { domainCodes, type DocErrorRegistry } from '../docs/errors.js';
import {
  BRIDGE_ERROR_SOURCE,
  CAPABILITY_REGISTRATION_ERROR_SOURCE,
  EVENT_ERROR_SOURCE,
  KERNEL_ERROR_SOURCE,
  PERMISSION_ERROR_SOURCE,
  RESOURCE_ERROR_SOURCE,
} from '../docs/sources.js';
import { diffSets, sortViolations, violation, type ContractViolation } from '../violations.js';

export interface ErrorCheckInput {
  readonly docs: DocErrorRegistry;
  readonly code: BridgeCodeModel;
  readonly host: HostCodeModel;
  /** Bridge 通道错误码的文档 retryable 口径（Bridge 错误码表）。 */
  readonly bridgeRetryable: ReadonlyMap<string, boolean>;
}

function checkDomainExact(
  violations: ContractViolation[],
  label: string,
  expected: readonly string[],
  actual: readonly string[]
): void {
  const diff = diffSets(expected, actual);
  for (const code of diff.missing) {
    violations.push(
      violation(
        'CONTRACT_ERROR_DOMAIN_MISSING',
        `${label}:${code}`,
        '文档登记的错误码未在实现侧登记',
        {
          expected: '实现侧登记表包含该错误码',
          actual: '缺失',
        }
      )
    );
  }
  for (const code of diff.extra) {
    violations.push(
      violation(
        'CONTRACT_ERROR_DOMAIN_EXTRA',
        `${label}:${code}`,
        '实现侧登记了文档未登记的错误码',
        {
          expected: '文档错误码表包含该错误码',
          actual: '未登记',
        }
      )
    );
  }
}

function checkSubset(
  violations: ContractViolation[],
  label: string,
  codes: readonly string[],
  allowed: readonly string[]
): void {
  const allowedSet = new Set(allowed);
  for (const code of codes) {
    if (!allowedSet.has(code)) {
      violations.push(
        violation(
          'CONTRACT_ERROR_DOMAIN_EXTRA',
          `${label}:${code}`,
          '实现侧登记了该域文档未登记的错误码'
        )
      );
    }
  }
}

function checkDuplicates(
  violations: ContractViolation[],
  label: string,
  codes: readonly string[]
): void {
  const seen = new Set<string>();
  for (const code of codes) {
    if (seen.has(code)) {
      violations.push(
        violation('CONTRACT_ERROR_DUPLICATE', `${label}:${code}`, '实现侧登记表存在重复错误码')
      );
    }
    seen.add(code);
  }
}

export function checkErrors(input: ErrorCheckInput): ContractViolation[] {
  const { docs, code, host, bridgeRetryable } = input;
  const violations: ContractViolation[] = [];

  const bridgeChannel = domainCodes(docs, BRIDGE_ERROR_SOURCE);
  const eventCodes = domainCodes(docs, EVENT_ERROR_SOURCE);
  const permissionCodes = domainCodes(docs, PERMISSION_ERROR_SOURCE);
  const kernelCodes = domainCodes(docs, KERNEL_ERROR_SOURCE);
  const resourceCodes = domainCodes(docs, RESOURCE_ERROR_SOURCE);
  const registrationCodes = domainCodes(docs, CAPABILITY_REGISTRATION_ERROR_SOURCE);

  checkDomainExact(violations, 'Bridge 通道错误码', bridgeChannel, code.errors.channel);
  checkDomainExact(violations, '事件错误码', eventCodes, code.errors.event);
  checkDomainExact(violations, '资源协议错误码', resourceCodes, host.resourceErrorCodes);

  checkSubset(violations, '权限拒绝错误码', code.errors.permissionRegistration, permissionCodes);
  checkSubset(violations, '内核生命周期错误码', code.errors.kernel, kernelCodes);
  checkSubset(violations, 'Bridge 资源控制错误码', code.errors.resource, resourceCodes);

  checkDuplicates(violations, 'Bridge 通道错误码', code.errors.channel);
  checkDuplicates(violations, '事件错误码', code.errors.event);
  checkDuplicates(violations, 'PAL 错误码', host.palErrorCodes);
  checkDuplicates(violations, '资源协议错误码', host.resourceErrorCodes);

  const implemented = new Set<string>([
    ...code.errors.channel,
    ...code.errors.event,
    ...code.errors.permissionRegistration,
    ...code.errors.kernel,
    ...code.errors.resource,
  ]);
  for (const entry of registrationCodes) {
    if (!implemented.has(entry)) {
      violations.push(
        violation(
          'CONTRACT_ERROR_REGISTRATION_MISSING',
          entry,
          '能力注册与契约错误码未在任何已实现登记表出现',
          { expected: 'Bridge 通道或权限登记表包含该错误码' }
        )
      );
    }
  }

  const registry = new Set(docs.all);
  const codeSide: readonly (readonly [string, readonly string[]])[] = [
    ['Bridge 通道错误码', code.errors.channel],
    ['事件错误码', code.errors.event],
    ['权限登记错误码', code.errors.permissionRegistration],
    ['内核错误码', code.errors.kernel],
    ['Bridge 资源控制错误码', code.errors.resource],
    ['PAL 错误码', host.palErrorCodes],
    ['资源协议错误码', host.resourceErrorCodes],
  ];
  for (const [label, codes] of codeSide) {
    for (const entry of codes) {
      if (!registry.has(entry)) {
        violations.push(
          violation(
            'CONTRACT_ERROR_UNREGISTERED',
            `${label}:${entry}`,
            '实现侧错误码未在文档错误码注册表登记（禁止自造错误码）'
          )
        );
      }
    }
  }

  for (const [entry, expected] of bridgeRetryable) {
    if (!bridgeChannel.includes(entry)) {
      continue;
    }
    if (!code.errors.channel.includes(entry)) {
      continue;
    }
    const actual = code.channelRetryable[entry];
    if (actual !== expected) {
      violations.push(
        violation(
          'CONTRACT_ERROR_RETRYABLE',
          `Bridge 通道错误码:${entry}`,
          '错误码 retryable 与文档表不一致',
          {
            expected: String(expected),
            actual: String(actual),
          }
        )
      );
    }
  }

  return sortViolations(violations);
}
