# 测试债务清单

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
      "status": "repaid",
      "approver": "测试批准人",
      "reason": "测试理由",
      "scope": "仅豁免测试夹具中 packages/native 造成的未达部分",
      "scopePaths": ["packages/native/"],
      "evidence": "测试证据",
      "repaymentTask": "测试工单T-000"
    }
  ]
}
```

<!-- GATE-EXEMPTIONS-END -->
