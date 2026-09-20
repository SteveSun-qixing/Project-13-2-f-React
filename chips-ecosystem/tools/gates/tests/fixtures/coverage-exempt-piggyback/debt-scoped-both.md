# 测试债务清单（工单027：全部未达标成员均有对应 scope 登记）

<!-- GATE-EXEMPTIONS-BEGIN -->

```json
{
  "schema": "chips-gate-exemptions/v2",
  "exemptions": [
    {
      "id": "TD-TEST",
      "gate": "G6",
      "group": "rust-core",
      "metric": "lines",
      "deadline": "2099-12-31",
      "status": "active",
      "approver": "测试批准人甲",
      "reason": "测试理由：模拟 TD-001 仅登记 chips-native 成因",
      "scope": "仅豁免 packages/native 造成的未达部分",
      "scopePaths": ["packages/native/"],
      "evidence": "测试证据",
      "repaymentTask": "测试工单T-000"
    },
    {
      "id": "TD-TEST2",
      "gate": "G6",
      "group": "rust-core",
      "metric": "lines",
      "deadline": "2099-12-31",
      "status": "active",
      "approver": "测试批准人乙",
      "reason": "测试理由：新成员自行登记的 scope 级豁免",
      "scope": "仅豁免 chips-newcrate 造成的未达部分",
      "scopePaths": ["packages/core-rust/crates/chips-newcrate/"],
      "evidence": "测试证据",
      "repaymentTask": "测试工单T-001"
    }
  ]
}
```

<!-- GATE-EXEMPTIONS-END -->
