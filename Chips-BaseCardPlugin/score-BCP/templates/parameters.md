# 评分基础卡片配置参数说明

本文件说明 [default-card-config.yaml](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/score-BCP/templates/default-card-config.yaml) 中各字段的正式含义与填写约束。

- `card_type`
  - 固定为 `"ScoreCard"`。
- `theme`
  - 可选主题覆盖标识，卡片格式契约保留字段；主题系统已废弃，当前固定使用生态统一苹果风格，留空即可。
- `style`
  - 评分展示样式，可选：
    - `stars`
    - `hearts`
    - `score`
    - `progress`
- `score`
  - 获得分数。
  - `stars` 与 `hearts` 为五分制整数，合法范围为 `0-5`。
  - `score` 与 `progress` 可以使用小数，归一化后不会小于 `0`，也不会超过 `total_score`。
- `total_score`
  - 总分。
  - `stars` 与 `hearts` 固定归一为 `5`。
  - `score` 与 `progress` 的合法范围为 `1-100000`。
- `locale`
  - 卡片格式契约保留字段；界面文案已统一简体中文直写，数字格式化固定使用中文（zh-CN）行为，建议填写 `zh-CN`。
