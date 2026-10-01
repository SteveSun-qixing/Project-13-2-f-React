import { describe, expect, it } from 'vitest';
import {
  CHIP_ID_PATTERN,
  hasCaseInsensitiveDuplicate,
  isValidChipId,
} from '../../src/domain/card/id';
import {
  FIXTURE_CARD_ID,
  FIXTURE_NODE_ID,
  FIXTURE_SECOND_NODE_ID,
} from '../fixtures/composite-card';

describe('ID 文法（05-ID生成规范 §二）', () => {
  it('文法为十位 Base62 精确匹配', () => {
    expect(CHIP_ID_PATTERN.source).toBe('^[0-9A-Za-z]{10}$');
  });

  it('接受文档在册示例标识与边界形态', () => {
    expect(isValidChipId(FIXTURE_CARD_ID)).toBe(true);
    expect(isValidChipId(FIXTURE_NODE_ID)).toBe(true);
    expect(isValidChipId(FIXTURE_SECOND_NODE_ID)).toBe(true);
    expect(isValidChipId('0000000000')).toBe(true);
    expect(isValidChipId('ABCDEFGHIJ')).toBe(true);
    expect(isValidChipId('aaaaaaaaaa')).toBe(true);
    expect(isValidChipId('a1B2c3D4e5')).toBe(true);
  });

  it('拒绝长度、字符集与全半角变体越界', () => {
    expect(isValidChipId('')).toBe(false);
    expect(isValidChipId('a1B2c3D4e')).toBe(false);
    expect(isValidChipId('a1B2c3D4e55')).toBe(false);
    expect(isValidChipId('a1B2c3D4-5')).toBe(false);
    expect(isValidChipId('a1B2c3D4_5')).toBe(false);
    expect(isValidChipId('a1B2c3D4e中')).toBe(false);
    expect(isValidChipId('a1B2c3D4é5')).toBe(false);
    expect(isValidChipId('ａ１Ｂ２ｃ３Ｄ４')).toBe(false);
    expect(isValidChipId('a1B2c3D4e5 ')).toBe(false);
  });

  it('大小写全程精确处理，不做归一化', () => {
    const lower = 'a1b2c3d4e5';
    expect(isValidChipId(lower)).toBe(true);
    expect(isValidChipId('A1B2C3D4E5')).toBe(true);
    expect(lower).toBe('a1b2c3d4e5');
  });

  describe('节点集合大小写不敏感等价查重（05-ID生成规范 §二.6、§六.1）', () => {
    it('空集合与单节点无重复', () => {
      expect(hasCaseInsensitiveDuplicate([])).toBe(false);
      expect(hasCaseInsensitiveDuplicate([FIXTURE_NODE_ID])).toBe(false);
    });

    it('不同标识不误报', () => {
      expect(hasCaseInsensitiveDuplicate([FIXTURE_CARD_ID, FIXTURE_NODE_ID])).toBe(false);
      expect(hasCaseInsensitiveDuplicate([FIXTURE_NODE_ID, FIXTURE_SECOND_NODE_ID])).toBe(false);
    });

    it('仅大小写不同的节点标识判等价重复', () => {
      expect(hasCaseInsensitiveDuplicate(['a1B2c3D4e5', 'A1B2C3D4E5'])).toBe(true);
      expect(hasCaseInsensitiveDuplicate([FIXTURE_NODE_ID, 'F6G7H8I9J0'])).toBe(true);
    });

    it('三个标识中存在等价对即命中', () => {
      expect(
        hasCaseInsensitiveDuplicate([FIXTURE_NODE_ID, FIXTURE_SECOND_NODE_ID, 'F6G7H8I9J0'])
      ).toBe(true);
    });
  });
});
