# 阶段三：组件库统一图标组件与 Token 落地

## 1. 阶段目标

在 `Chips-ComponentLibrary` 中交付正式的统一图标组件、图标描述符、token、契约和测试，使组件库成为生态运行时图标的唯一基础设施提供方。

## 2. 涉及范围

1. `Chips-ComponentLibrary/packages/components`
2. `Chips-ComponentLibrary/packages/tokens`
3. `Chips-ComponentLibrary/packages/theme-contracts`
4. `Chips-ComponentLibrary/技术文档`

## 3. 当前基线

1. 组件库没有 `ChipsIcon`；
2. 默认图标仍通过内联 SVG fallback 输出；
3. 只有局部组件级 `icon.color` token；
4. 组件文档仍提到“默认语义 SVG”。

## 4. 核心任务

1. 实现 `ChipsIcon`；
2. 定义并导出 `ChipsIconDescriptor`；
3. 把现有组件默认图标全部切到统一图标组件；
4. 补齐图标 token 和契约；
5. 补齐图标可访问性、语义名映射和视觉参数测试；
6. 清理旧 SVG fallback 和相关文档。

## 5. 交付物

1. 统一图标组件与类型；
2. 图标 token；
3. 组件默认图标重构；
4. 测试与文档更新。

## 6. 验证

- `cd Chips-ComponentLibrary && npm run verify`
- `cd Chips-ComponentLibrary && npm run test:contracts`
- `cd Chips-ComponentLibrary && npm run test:a11y`

## 7. 完成判定

只有当组件库所有默认图标都不再依赖散落的 SVG path，且统一图标组件已具备正式测试覆盖时，本阶段才算完成。
