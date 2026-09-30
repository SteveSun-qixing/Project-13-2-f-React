/**
 * 【归档件 · 工单036 波 C3 / 任务：宿主 IDocumentStoragePort 正式适配器接线与
 * `document:save` 终闸】production-wiring storage 缺位登记臂退役快照。
 *
 * 退役原因（载体落位，非行为放宽）：
 * - 本段为装载闸的 storage 缺位成因登记（工单036 §二：`storage` 载体为资源管理器受控
 *   提交路径与 WriteCoordinator，彼时 Rust 侧 C2a 未交付、§11.3 Neon 暴露面无跨成员
 *   原子提交与落盘序列化载体，正式适配器无载体可构造 ⇒ 生产缺位、装载段整体回退）。
 * - 波 C2a-1/2/3（提交日志 / changeset 两相提交 / 归档整包换代）与波 C3 Neon 扩表两名
 *   （`resourceCommitChangeset` / `resourceRebuildArchive`）落位后，正式 storage 适配器
 *   （`packages/host/src/capabilities/document/adapters/storage-adapter.ts`）已随装载段
 *   以资源域类型化消费面构造（scope / storage 两正式适配器共享同一在册账）；缺位臂的
 *   唯一剩余成因收敛为「资源域导出面未落位」（产物缺位 / 旧构建漂移 / ABI 漂移，
 *   fail-closed 诚实呈现，与 scope 臂同判据同措辞结构），「尚无载体」的旧措辞退役。
 *   不留第二套活写路径。
 *
 * 本文件自 2026-10 起**不参与任何构建与测试**（不参与 tsc/eslint：置于 packages 之外），
 * 仅作退役可追溯快照保留。装载闸本体（缺位判定结构与诊断留痕）未退役，仍现役于
 * `production-wiring.ts`（成因文本已随本波翻正）。
 *
 * ———— 以下为退役当日（切换前最后一版）原文逐字快照 ————
 */

  if (storagePort === undefined) {
    missing.push({
      port: 'storage',
      reason:
        '受控写端口的文档载体为资源管理器受控提交路径与 WriteCoordinator（chips-resource，工单 036）：' +
        'Rust 侧已交付，§11.3 Neon 暴露面尚无跨成员原子提交与落盘序列化载体（刀6 裁决、点位四后续波），' +
        `正式适配器随该载体落地；禁止内存替身（原生侧资源域实态判据：${resourceSurfaceVerdict}）`,
    });
  }
