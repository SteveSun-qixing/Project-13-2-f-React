# 任务007：Host commands 注册与调度

## 1. 任务目标

建立 Host command registry，让菜单、工具栏、快捷键、命令面板共享统一 command 语义。

## 2. 对应阶段任务

- `05-开发任务方案/任务11-导航菜单工具栏与命令系统.md`

## 3. 涉及项目

- `Chips-Host`
- `Chips-SDK`
- `Chips-ComponentLibrary`

## 4. 开发内容

1. 定义 command schema。
2. Host 注册、注销、查询、调用 command。
3. command scope 和 permission 校验。
4. Bridge/SDK 暴露正式 action。
5. 测试菜单/工具栏/快捷键复用。

## 5. 验收标准

- command 可被多入口复用。
- 权限不足有标准错误。
- command 文案使用 i18n key。

## 5.1 本任务边界补充

- 本任务先交付 Host command registry、Bridge 子域、SDK Domain API、route manifest、权限/scope 校验和公共契约文档。
- 组件库 Toolbar/Menu/CommandPalette 的具体组件消费、应用脚手架默认模板接入、React hooks 接入分别进入后续任务，不在本任务内用局部实现抢跑。
- 若后续发现新的 command 消费面，应按编号小数任务插入本目录，不把后续工作只留在工作日志中。

## 6. 验证命令

```bash
cd Chips-Host && npm run build && npm test && npm run test:contract
cd ../Chips-SDK && npm test
```
