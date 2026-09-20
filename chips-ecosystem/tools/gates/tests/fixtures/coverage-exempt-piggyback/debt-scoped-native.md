# 测试债务清单（工单027：登记范围仅 chips-native，新成员不得搭组）

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
      "approver": "测试批准人",
      "reason": "测试理由：模拟 TD-001 仅登记 chips-native 成因",
      "scope": "仅豁免 packages/native 造成的未达部分；其余 crate 判定不受影响",
      "scopePaths": ["packages/native/"],
      "evidence": "测试证据",
      "repaymentTask": "测试工单T-000"
    }
  ]
}
```

<!-- GATE-EXEMPTIONS-END -->
