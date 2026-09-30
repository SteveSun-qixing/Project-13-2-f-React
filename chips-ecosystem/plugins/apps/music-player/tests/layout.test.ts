import { describe, expect, it } from 'vitest';
import { resolveMobilePagerTargetPage, shouldUseMobilePagerLayout } from '../src/player/layout';

/** 紧凑视口分页布局判例（随迁自旧仓 tests/unit/layout.test.ts，逐条保真）。 */

describe('mobile pager layout', () => {
  it('uses the swipe pager for narrow portrait viewports', () => {
    expect(shouldUseMobilePagerLayout(390, 844)).toBe(true);
    expect(shouldUseMobilePagerLayout(768, 1024)).toBe(true);
  });

  it('keeps the desktop layout for landscape or wide windows', () => {
    expect(shouldUseMobilePagerLayout(844, 390)).toBe(false);
    expect(shouldUseMobilePagerLayout(1280, 900)).toBe(false);
    expect(shouldUseMobilePagerLayout(980, 1400)).toBe(false);
  });

  it('guards against invalid viewport sizes', () => {
    expect(shouldUseMobilePagerLayout(0, 720)).toBe(false);
    expect(shouldUseMobilePagerLayout(720, 0)).toBe(false);
  });

  it('moves between pages when the swipe distance exceeds the threshold', () => {
    expect(resolveMobilePagerTargetPage(0, -120, 390)).toBe(1);
    expect(resolveMobilePagerTargetPage(1, 120, 390)).toBe(0);
  });

  it('stays on the current page when the swipe is too short', () => {
    expect(resolveMobilePagerTargetPage(0, -40, 390)).toBe(0);
    expect(resolveMobilePagerTargetPage(1, 40, 390)).toBe(1);
  });

  it('clamps invalid page inputs and handles empty widths safely', () => {
    expect(resolveMobilePagerTargetPage(-2, -200, 0)).toBe(0);
    expect(resolveMobilePagerTargetPage(4, 200, 390)).toBe(0);
  });
});
