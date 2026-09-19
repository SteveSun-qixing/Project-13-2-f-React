# 重构 Host 底层打通全平台应用插件调用机制开发计划

## 1. 文档定位

本文档记录 task011 的实施拆解与完成状态。

不包含：

1. 人员分配
2. 时间排期
3. 资源预算

## 2. 阶段清单与完成状态

### 阶段一：公共契约冻结

状态：已完成

完成内容：

- 重新核对 Host、SDK、Manifest、Scaffold、社区服务器代码
- 回写共享文档中的 PAL、Bridge、Host 服务域、Host 对外接口、应用插件、Manifest 口径

### 阶段二：Host Core 与 Shell 拆分

状态：已完成

完成内容：

- 落地 `HostCore`
- 落地 `DesktopHostShell`
- 落地 `HeadlessHostShell`
- 补齐 `chips-host` 对外导出

### 阶段三：PAL 2.0 重构

状态：已完成

完成内容：

- PAL 能力分面化
- 结构化能力快照
- Desktop / Headless 双适配器

### 阶段四：Host 服务域重组

状态：已完成

完成内容：

- 新增 `surface`
- 新增 `transfer`
- 新增 `association`
- 收口 `platform`

### 阶段五：Bridge / Runtime Client / SDK 对齐

状态：已完成

完成内容：

- Bridge 新增 `surface / transfer / association`
- preload 对外暴露新子域
- SDK 新增对应 API
- `platform.getCapabilities()` 升级为结构化快照

### 阶段六：Manifest、Scaffold 与官方插件清单升级

状态：已完成

完成内容：

- `runtime.targets`
- `ui.surface`
- `capabilityFallbacks`
- Scaffold 模板更新
- 官方插件清单更新

### 阶段七：应用插件统一启动链路收口

状态：已完成

完成内容：

- `surface.open(target=plugin)` 正式创建插件会话
- `plugin.launch` 复用同一底层实现
- 新增回归测试锁定权限边界与启动行为

### 阶段八：Headless 宿主接入生态工程

状态：已完成

完成内容：

- 社区服务器接入 `HeadlessHostShell`
- 社区服务器正式构建验证通过

### 阶段九：发布级验证

状态：部分完成

已完成：

- Host 正式构建 / 单元 / 集成 / 契约测试
- 社区服务器正式构建
- Scaffold 正式测试与模板检查
- 社区前台 `/cards/:cardId` 浏览器级定向验证
- 原版 `PhotoViewer` Web 会话恢复链路定向验证
- 插件新标签页打开策略定向验证
- `PhotoViewer` 宿主页全视口承载定向验证
- `PhotoViewer` Web 手势接管链路定向核查

未继续执行：

- `Chips-SDK` 全量长链路测试

原因：

- 用户已明确说明“不用跑完整全套的测试”

## 3. 本轮必须长期保留的产物

1. `HostCore`
2. `DesktopHostShell`
3. `HeadlessHostShell`
4. PAL 2.0 contracts 与 Desktop / Headless 适配器
5. `surface / transfer / association` 服务域
6. Bridge 新子域与 SDK API
7. Manifest vNext 校验口径
8. 社区服务器 Headless Host 集成

## 4. 后续增量任务

以下任务已经不再阻塞本轮交付，但属于下一轮增量工作：

1. 实现 `WebHostShell`
2. 实现 `MobileHostShell`
3. 进一步减少 `window` legacy 入口在生态代码中的显式使用
4. 视需要补充 Web / Mobile 对 `transfer.share`、`association` 的具体适配器

## 5. 结论

本轮开发计划的核心目标已经完成：

- 底层运行时形态完成统一
- 应用插件跨平台调用主语义完成统一
- 生态公共契约、官方模板和社区服务器接入全部同步到位
