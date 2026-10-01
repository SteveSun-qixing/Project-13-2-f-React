# W5 阶段 Checkpoint · 三段式应用迁移与端到端解锁 · 2026-10-01

## Checkpoint W5-A · 应用迁移主体与宿主能力面 · 2026-10-01

- 本阶段目标：执行用户指令三段式（①脚手架 → ②create 初始化 → ③迁移），交付 13 官方应用的可运行包与端到端解锁前置件。

- 完成项（证据：命令 EXIT + 文件路径 + 提交号）：
  1. **第①②段**：app 模板试点（photo-viewer，四闸+cpk+G1 全过，同参再生 diff 字节级一致）+ 12 应用骨架批量初始化，24/24 四闸绿（提交 c5bc125e3/ab8398260）。
  2. **第③段三批**：photo-viewer 50/video-player 67/book-reader 132/music-player 133/icon-maker 56（cf6f5bd3a）；uvf 引擎+壳 59+83、editor 搬运 12、rte 领域 79、notes 62（含写面）、settings 60（含持久化翻正）、resource-manager 24、office 三域 87、community-client 82（84b898831/fb243eaa1/c2ecbf1e2）。
  3. **宿主能力面**：C3 document 四能力真实现（changeset 两相+真机 smoke）+ G6 两批十二域注册（dialog/clipboard/notification/shell/http/power/transfer/menu/tray/shortcut/config/event），host 1559→1694 用例；resource:open 路由域+全作用域读面（槽位路由+opened 发布+权限第一级）。
  4. **端到端**：金链路 golden-chain-w2 恢复 3 passed（工单070 收口）；性能真测五项——冷启动 530.84ms✓/空闲内存 368.59MB✓/开卡 13.92ms✓（端到端复采 3.52ms✓）/开箱 97.30ms✓/scroll-fps **50.00fps 真实红项如实登记**（归因候 #99 渲染臂）；回执 项目日志与笔记/性能真测回执-2026-10-01.md。
  5. **SDK**：edit/ 契约类型面八模块+20 双向锁测（227 用例）。

- 未完成项与原因：
  1. T6 窗口运行时/T7 帧通道本体（工单036 残段）：候下一波 host 独占路（quota 限流致本波未派）。
  2. richtext/word 编辑臂：候用户编辑引擎选型；十三项 document:export 提供方候裁。
  3. scroll-fps 50fps：真渲染负载通道候 #99。
  4. score/video 两族：候第十二项；W6 服务端 15 行：勘查就绪候开波。

- 下一步：T6+T7 → editor 主体臂 → 查看器族打开臂端到端翻正复采 → W6 开波。

- 目标状态：进行中（五闸全绿 5,585 用例；W5 主体交付过半，残段全部有主有单）。
