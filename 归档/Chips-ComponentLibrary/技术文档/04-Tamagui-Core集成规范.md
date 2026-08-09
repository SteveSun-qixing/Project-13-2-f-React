# Tamagui (Core) 集成规范

## 1. 集成目的

Tamagui (Core) 用于统一 token 语义消费和跨端样式语义层，不替代 Ark UI 交互能力。

- Ark UI：负责组件交互逻辑、状态机、无障碍
- Tamagui Core：负责 token 类型化、主题变量消费、运行时主题上下文

## 2. 集成边界

- 只使用 `@tamagui/core` 必要能力
- 不引入 Tamagui 额外 UI 组件体系
- 不在组件中写入视觉样式常量

## 3. Token 对接流程

1. Style Dictionary 输出标准 token JSON + CSS 变量
2. `adapters/tamagui-core` 将 token 转换为 Tamagui Core 可消费对象
3. 组件通过统一 hook 读取语义 token key，不直接访问原始值
4. 主题切换时仅更新变量映射，不重建组件结构

## 4. 推荐数据结构

```ts
export type ChipsTokenKey =
  | 'sys.color.primary'
  | 'sys.color.onPrimary'
  | 'comp.button.height.md'
  | 'motion.duration.fast'
  | 'layout.gap.md';

export interface TokenResolver {
  get: (key: ChipsTokenKey) => string;
  has: (key: ChipsTokenKey) => boolean;
}
```

## 5. React 接入模式

- `ChipsTokenProvider`：注入 token resolver
- `useToken(key)`：读取 token 值
- `useComponentTokens(scope)`：按组件作用域读取 token 映射

## 6. 运行时约束

- Token 缺失必须产生可追踪告警日志
- 解析失败必须回退至默认主题 token
- 不允许在组件渲染函数内执行昂贵 token 合并

## 7. 兼容策略

- Web 主线：CSS 变量 + Tamagui Core resolver
- 未来移动端：沿用同一 token key，替换平台适配层
- 新增 token 层级时必须保持旧 key 的别名兼容窗口

## 8. 当前实现（2026-03-04）

已落地适配能力（`packages/adapters/tamagui-core`）：

- `createScopedTokenResolver`：按作用域链解析 token，支持 fallback 与诊断回调。
- `resolveScopedTokenValue`：单 key 解析并返回来源作用域（`component/base-card/.../fallback`）。
- `createThemeCacheKey`：统一缓存键格式 `themeId:version`。
- `createTamaguiCoreTokens`：将 `chips.*` token 映射为 Tamagui Core 可消费对象。

已落地 hooks 侧消费能力（`packages/hooks`）：

- `ChipsThemeProvider`
- `useToken`
- `useComponentTokens`
- `useThemeRuntime`
- `applyThemeVariables`
- `applyThemeVariablesInBatches`
- `subscribeThemeChanged`

已落地性能与诊断能力：

- 大范围变量变更可按批次注入（分片更新，避免一次性大写入）。
- 解析器支持 `onDiagnostic` 输出 fallback 与 missing token 诊断事件。
