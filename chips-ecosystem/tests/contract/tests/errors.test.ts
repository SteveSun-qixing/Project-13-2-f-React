import { describe, it } from 'vitest';

import { checkErrors } from '../src/check/errors.js';
import { assertNoViolations } from '../src/violations.js';
import { bridgeCode, bridgeRetryable, docs, hostCode } from './helpers.js';

describe('错误码表一致性', () => {
  it('Bridge、事件、资源错误码集合与文档表一致，其余登记表为文档子集', () => {
    assertNoViolations(
      checkErrors({
        docs: docs().errors,
        code: bridgeCode(),
        host: hostCode(),
        bridgeRetryable: bridgeRetryable(),
      }),
    );
  });
});
