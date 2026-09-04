/**
 * ID 生成工具测试
 */

import { describe, it, expect } from 'vitest';
import { generateDocumentId } from '../../src/lib/id';

describe('ID 生成工具', () => {
  describe('generateDocumentId', () => {
    it('应该生成 10 位字符的文档 ID', () => {
      const id = generateDocumentId();
      expect(id).toHaveLength(10);
    });

    it('只应包含 Base62 字符', () => {
      const id = generateDocumentId();
      expect(id).toMatch(/^[0-9A-Za-z]+$/);
    });

    it('多次生成的 ID 应基本唯一', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i += 1) {
        ids.add(generateDocumentId());
      }
      expect(ids.size).toBeGreaterThan(95);
    });

    it('不应包含 Base62 字符集之外的字符', () => {
      for (let i = 0; i < 50; i += 1) {
        const id = generateDocumentId();
        for (const char of id) {
          expect('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz').toContain(char);
        }
      }
    });
  });
});
