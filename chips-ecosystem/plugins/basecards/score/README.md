# 评分基础卡片插件

> 角色：`basecard`；插件 ID：`chips.basecard.score`；卡片类型：`base.score`；版本：`0.1.0`

在复合卡片中呈现一个评分内容节点：支持星星、爱心、数字分数与进度条四种展示样式。
旧族 `Chips-BaseCardPlugin/score-BCP` 按覆盖矩阵（旧功能覆盖矩阵-三插件仓库-2026-09-20）
「同装配模式迁移」，InputNumber 经用户裁决放行（用户裁决记录 2026-10-01）后完成迁移。

## 目录结构

```text
score/
├── manifest.yaml                          # 唯一权威清单
├── package.json                           # 工作区包 @chips/plugin-score，version 与 manifest 一致
├── tsconfig.json                          # 继承仓库 tsconfig.base.json
├── vite.shared.ts                         # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts                    # 主进程入口构建 → dist/index.js
├── vite.render.config.ts                  # 渲染入口构建 → render.js
├── vitest.config.ts                       # 测试配置（单元测试与包级集成测试）
├── tests/setup.ts                         # jsdom 环境补充（matchMedia / ResizeObserver 桩）
├── src/config.ts                          # 配置模型：归一、计分比率、字段级错误、校验
├── src/main.ts                            # 主进程纯函数源码 → dist/index.js
├── src/view.tsx                           # 查看态视图 → render.js
├── src/editor.tsx                         # 编辑态面板 → render.js
├── src/render.tsx                         # renderView / renderEditor 源码 → render.js
├── src/index.ts                           # 源码拆分导出（非构建入口）
├── tests/                                 # vitest 单元测试（jsdom）
├── assets/icons/score.svg                 # 卡片类型图标
└── assets/schemas/score-card-config.schema.json  # 配置 schema（2020-12）
```

## 卡片配置（`content.config`）

配置 schema 见 `assets/schemas/score-card-config.schema.json`，字段口径与 `src/config.ts`
的归一/校验保持一致：

| 字段          | 类型                                      | 默认值 | 说明                                                                 |
| ------------- | ----------------------------------------- | ------ | -------------------------------------------------------------------- |
| `style`       | `stars` \| `hearts` \| `score` \| `progress` | `stars` | 展示样式：星星、爱心、分数、进度条                                    |
| `score`       | number                                    | `0`    | 获得分数；数值样式钳制在 `[0, total_score]`，符号样式取整且 ≤ 5        |
| `total_score` | number                                    | `5`    | 总分；数值样式 1–100000，星星与爱心固定五分制                          |

相对旧版评分卡片的字段变化：`card_type` 移出 config（节点内容顶层归一为 `base.score`，
旧字面量 `ScoreCard` 以 manifest `aliases` 保留兼容读）；`theme` / `locale` 删除
（主题与多语言系统已随 task030 废弃）。

## 计分语义（自旧族迁移）

- 星星/爱心：固定五分制，`score` 归一为 0–5 整数（四舍五入）。
- 分数/进度条：`total_score` 归一钳制在 `[1, 100000]`，`score` 钳制在 `[0, total_score]`，
  支持最多两位小数的展示格式化（zh-CN 千位分隔）。
- 进度条与百分比按 `getScoreRatio`（钳制到 `[0, 1]`）计算，为查看态与编辑态预览的唯一口径。
- `validateConfig`（08 §2.4.3）按「出现即校验」执行：字段缺席不阻断（由归一回退默认值），
  字段出现则类型必须合法，并补充符号样式五分制整数与 `score ≤ total_score` 业务约束。

## 已知边界

- 查看态与编辑态均为纯展示/纯配置面板，不调用 `window.chips` 能力，`permissions` 保持空数组
  （权限最小化）；后续如扩展「评分交互」（非只读 Rate）需要新的宿主能力时，按工单流程先登记。
- 渲染帧（sandbox iframe）内主题由平台 vendor 的 `@chips/ui` 提供，插件不自装
  ConfigProvider / 多语言（08 §5.4）。
