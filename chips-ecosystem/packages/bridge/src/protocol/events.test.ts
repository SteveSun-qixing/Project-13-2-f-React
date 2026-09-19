import { describe, expect, it } from 'vitest';
import {
  EVENT_ERROR_CODES,
  EVENT_PAYLOAD_MAX_BYTES,
  findStandardEvent,
  isStandardEvent,
  isValidEventId,
  STANDARD_EVENTS,
} from './events.js';

describe('isValidEventId', () => {
  it('接受 `<domain>:<action>` 形态', () => {
    expect(isValidEventId('document:changed')).toBe(true);
    expect(isValidEventId('sync:state-changed')).toBe(true);
    expect(isValidEventId('tray:clicked')).toBe(true);
  });

  it('拒绝点号、大写、多冒号、空段与非法首字符', () => {
    expect(isValidEventId('document.changed')).toBe(false);
    expect(isValidEventId('Document:changed')).toBe(false);
    expect(isValidEventId('document:changed:extra')).toBe(false);
    expect(isValidEventId(':changed')).toBe(false);
    expect(isValidEventId('document:')).toBe(false);
    expect(isValidEventId('1document:changed')).toBe(false);
    expect(isValidEventId('-document:changed')).toBe(false);
  });
});

describe('标准事件登记表', () => {
  it('登记 39 项且 ID 唯一，内部域不入表', () => {
    expect(STANDARD_EVENTS).toHaveLength(39);
    expect(new Set(STANDARD_EVENTS.map((item) => item.id)).size).toBe(39);
    expect(STANDARD_EVENTS.some((item) => item.id.startsWith('internal:'))).toBe(false);
  });

  it('每项 ID 均通过文法校验', () => {
    for (const definition of STANDARD_EVENTS) {
      expect(isValidEventId(definition.id)).toBe(true);
    }
  });

  it('查询与判定', () => {
    expect(findStandardEvent('security:audit')?.visibility.kind).toBe('platform');
    expect(findStandardEvent('resource:opened')?.visibility).toEqual({
      kind: 'plugin-field',
      field: 'pluginId',
    });
    expect(findStandardEvent('command:invoked')?.visibility.kind).toBe('owner-lookup');
    expect(findStandardEvent('document:changed')).toMatchObject({ id: 'document:changed' });
    expect(findStandardEvent('internal:service')).toBeUndefined();
    expect(isStandardEvent('document:changed')).toBe(true);
    expect(isStandardEvent('editor:dirty')).toBe(false);
  });

  it('事件载荷上限为 256 KiB，错误码与事件契约一致', () => {
    expect(EVENT_PAYLOAD_MAX_BYTES).toBe(262144);
    expect(EVENT_ERROR_CODES.idInvalid).toBe('EVENT_ID_INVALID');
    expect(EVENT_ERROR_CODES.notRegistered).toBe('EVENT_NOT_REGISTERED');
    expect(EVENT_ERROR_CODES.subscribeDenied).toBe('EVENT_SUBSCRIBE_DENIED');
    expect(EVENT_ERROR_CODES.publishDenied).toBe('EVENT_PUBLISH_DENIED');
    expect(EVENT_ERROR_CODES.payloadUnsupported).toBe('EVENT_PAYLOAD_UNSUPPORTED');
    expect(EVENT_ERROR_CODES.payloadTooLarge).toBe('EVENT_PAYLOAD_TOO_LARGE');
    expect(EVENT_ERROR_CODES.depthExceeded).toBe('KERNEL_EVENT_DEPTH_EXCEEDED');
  });
});
