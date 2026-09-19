# 任务002：Host L8 原语与 Modifier 补齐

## 1. 任务目标

补齐 L8 声明式 UI 的标准原语和 Modifier，使它能覆盖应用界面、普通页面结构、卡片/箱子动态 UI 和配置页。

## 2. 对应阶段任务

- `05-开发任务方案/任务02-Host-L8声明式UI产品化.md`

## 3. 涉及项目

- `Chips-Host/src/renderer/declarative-ui`
- `Chips-Host/tests/unit/declarative-ui.test.ts`
- `生态共用技术文档/架构设计/17-L8声明式UI实现与接口细则.md`

## 4. 开发内容

1. 补齐原语：`Section`、`ScrollView`、`Text`、`Image`、`Media`、`Table`、`Navigation`、`Toolbar`、`Command`、`Slot`。
2. 定义 modifier：themeScope、i18nKey、layout、accessibility、focusScope、shortcut、permission、presentation、motion、testId。
3. 更新类型和节点创建工具。
4. 更新单测。
5. 同步公共文档。

## 5. 验收标准

- 原语类型完整。
- Modifier 语义稳定。
- 不包含视觉硬编码字段。
- 单测覆盖新增原语和 modifier。

## 6. 验证命令

```bash
cd Chips-Host
npm run build
npm test
```

