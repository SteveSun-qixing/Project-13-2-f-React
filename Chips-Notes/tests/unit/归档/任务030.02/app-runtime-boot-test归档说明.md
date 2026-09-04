# app-runtime-boot.test.ts 归档说明

任务030.02迁移期间曾补充一份较窄的 `app-runtime-boot.test.ts`，用于验证默认工具窗口创建、启动顺序和插件生命周期刷新。

随后发现同阶段新增的正式测试 `tests/unit/app-runtime.test.ts` 已覆盖更完整的范围：

- launch context 合并与 environment launch context 转换；
- SDK client 到 `ChipsEnvironmentProvider` 消费形态的适配；
- 默认工具窗口的冻结布局；
- 启动流程的 basecard/i18n/workspace/default tools 顺序；
- 插件安装、启用、禁用、卸载事件触发基础卡片注册表刷新。

为避免重复测试噪声，窄测试不再作为正式测试文件保留；本说明记录归档原因。正式验证入口以 `tests/unit/app-runtime.test.ts` 为准。
