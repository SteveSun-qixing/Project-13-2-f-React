// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { formatMessage } from '../../src/lib/messages';

describe('formatMessage', () => {
  it('resolves text from the local Chinese message table', () => {
    expect(formatMessage('common.save')).toBe('保存');
  });

  it('interpolates params and falls back to the key for unknown messages', () => {
    expect(formatMessage('workbench.close_tab', { title: 'demo.card' })).toBe('关闭 demo.card');
    expect(formatMessage('unknown.message.key')).toBe('unknown.message.key');
  });
});
