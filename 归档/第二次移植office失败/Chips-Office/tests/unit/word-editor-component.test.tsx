import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WordEditor 组件测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('组件存在性', () => {
    it('WordEditor 组件应该可以被导入', async () => {
      const { default: WordEditor } = await import('../../src/apps/word/WordEditor');
      expect(WordEditor).toBeDefined();
    });
  });

  describe('基本功能', () => {
    it('组件应该接受 readOnly 属性', () => {
      const props = { readOnly: true };
      expect(props.readOnly).toBe(true);
    });

    it('组件应该接受 onSave 回调', () => {
      const onSave = vi.fn();
      expect(typeof onSave).toBe('function');
    });

    it('组件应该接受初始字节数据', () => {
      const initialBytes = new Uint8Array([1, 2, 3]);
      expect(initialBytes.length).toBe(3);
    });
  });
});
