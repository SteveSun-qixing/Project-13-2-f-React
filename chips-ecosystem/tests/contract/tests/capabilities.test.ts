import { describe, it } from 'vitest';

import { checkCapabilities } from '../src/check/capabilities.js';
import { assertNoViolations } from '../src/violations.js';
import { bridgeCode, docs } from './helpers.js';

describe('能力表 ↔ Bridge 注册表一致性', () => {
  it('R19 总表与 BUILTIN_CAPABILITIES 的 ID 与权限映射逐项一致', () => {
    const models = docs();
    assertNoViolations(
      checkCapabilities({
        docs: models.capabilities,
        docPermissions: models.permissions,
        code: bridgeCode(),
      }),
    );
  });
});
