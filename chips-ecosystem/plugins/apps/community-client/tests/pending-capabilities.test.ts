import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_PENDING_CAPABILITIES,
  findPendingCapability,
} from '../src/domain/community/pendingCapabilities';

describe('候前置件登记表（起步臂诚实降级登记，唯一事实源）', () => {
  it('登记项稳定：网络臂、会话臂、传输臂、配置持久化、对话框/浏览器入口、服务端联调', () => {
    expect(COMMUNITY_PENDING_CAPABILITIES.map((item) => item.id)).toEqual([
      'network',
      'session',
      'transfer',
      'config',
      'dialog-shell',
      'server',
    ]);
  });

  it('每条登记项说明缺失域、降级口径与落波去向（简体中文直写、不携带内部路径）', () => {
    for (const item of COMMUNITY_PENDING_CAPABILITIES) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.domain.length).toBeGreaterThan(0);
      expect(item.pendingBecause.length).toBeGreaterThan(0);
      expect(item.unlockWave.length).toBeGreaterThan(0);
      expect(item.pendingBecause).not.toMatch(/\/Users\//);
    }
  });

  it('网络臂登记：http:request 宿主处理器未注册（G6 后续批），网络请求臂不假接线', () => {
    const network = findPendingCapability('network');
    expect(network).not.toBeNull();
    expect(network?.domain).toContain('http:request');
    expect(network?.domain).toContain('G6');
  });

  it('传输臂登记：客户端不实现传输协议（§2.3），编排入口候 transfer:* 落波', () => {
    const transfer = findPendingCapability('transfer');
    expect(transfer?.domain).toContain('transfer:*');
  });

  it('服务端联调登记：服务端 W6 未迁移，联调面候前置件', () => {
    const server = findPendingCapability('server');
    expect(server?.domain).toContain('W6');
  });

  it('未知标识返回 null（调用方不静默回退）', () => {
    expect(findPendingCapability('nope')).toBeNull();
  });
});
