# score-BCP AGENTS

## 角色

- 本项目是评分基础卡片插件；正式职责是管理评分类基础卡片的查看、编辑和配置生命周期。

## 开发规则

- 查看态、编辑态、schema、默认模板和界面文案必须同步演进；不要出现界面行为、配置模型和文档三套口径。
- 视觉样式固定为生态统一苹果风格：antd token / 共享层 `appleTheme`（`@chips/ui`）与本地样式常量，禁止引入第二套视觉，禁止使用已废弃的主题系统变量（`--chips-sys-*`）与组件库 `data-scope/data-part` 接口点。
- 界面文案简体中文直写，文案总表维护在 `src/lib/messages.ts`，禁止重新引入多语言系统。
- 卡片格式契约字段（`card_type`、`theme`、`style`、`score`、`total_score`、`locale`）与 `basecardDefinition` 保持不变；`locale` 保留但不消费。
- 若评分插件需要新增公共资源协议、公共布局字段或生态级交互约定，先登记工单并同步共用文档。

## 验证

- 变更后至少运行与改动相关的 `lint`、`typecheck`、`test`、`build`、`validate` 及对应单元/集成测试。
