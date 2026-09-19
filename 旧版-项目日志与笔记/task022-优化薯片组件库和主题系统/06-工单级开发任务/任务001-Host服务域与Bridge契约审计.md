# 任务001：Host 服务域与 Bridge 契约审计

## 1. 任务目标

审计 Host 服务域、Bridge action、SDK route manifest 和共享文档是否一致，为后续 L8/L9、surface、commands、theme、plugin 迁移打基础。

## 2. 对应阶段任务

- `05-开发任务方案/任务01-公共契约冻结与任务基线.md`
- `05-开发任务方案/任务04-App-Scene-surface-commands应用结构能力.md`

## 3. 涉及项目

- `Chips-Host`
- `Chips-SDK`
- `生态共用技术文档/协议与接口标准/02-Bridge-API规范.md`
- `生态共用技术文档/架构设计/14-Host服务域设计.md`

## 4. 开发内容

1. 对比 Host schema 与 SDK route manifest。
2. 对比 Bridge 文档与 `create-bridge.ts`。
3. 核查 theme/i18n/surface/plugin/module/card/box/resource/file/config 等服务域。
4. 输出漂移清单。
5. 发现缺口登记工单。

## 5. 验收标准

- Host/SDK/文档三方差异可追踪。
- 所有 P0/P1 漂移有工单。
- 后续任务不再基于过期口径开发。

## 6. 验证命令

```bash
cd Chips-Host && npm run build && npm run test:contract
cd ../Chips-SDK && npm test
```

