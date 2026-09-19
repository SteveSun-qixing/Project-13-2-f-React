# 任务010：SDK Domain API 补齐与类型同步

## 1. 任务目标

确保 SDK 的 domain API 与 Host 服务域、Bridge action 和共享文档完全对齐。

## 2. 对应阶段任务

- `05-开发任务方案/任务05-SDK-RuntimeClient与React消费入口.md`

## 3. 涉及项目

- `Chips-SDK/src/api/*`
- `Chips-SDK/src/contracts/route-manifest.json`
- `Chips-SDK/tests/tooling/contract-drift.test.ts`

## 4. 开发内容

1. 对齐 theme/i18n/surface/platform/plugin/module/card/box/resource/file/config/document/transfer/association/zip。
2. 缺失 API 补类型和测试。
3. route manifest 与 Host schema 对齐。
4. 输出 contract drift 报告。

## 5. 验收标准

- Host/SDK route 无漂移。
- 所有公共 API 有类型。
- SDK 测试通过。

## 6. 验证命令

```bash
cd Chips-SDK
npm test
cd ../Chips-Host
npm run test:contract
```

