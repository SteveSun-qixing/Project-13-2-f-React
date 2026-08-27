# 会话记录：mighty-mountain

- 会话 ID：ses_0112087efffeHLQEiXuyVdn7wL
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-11 11:30:50

---

## 2026-08-11 11:30:50

修复薯片生态 video-BCP 检查发现的所有问题。不做 Git 提交。

## 仓库
/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-BaseCardPlugin/video-BCP

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/03-统一视觉规范（苹果风格设计系统）.md（圆角 8~12px、焦点环、hover/active 四态、统一 antd token）

## 修复清单（含证据位置）

### 功能（优先）
1. **[一般] 字幕资源 URL 解析结果从未被消费**：view.tsx:467-471 useResolvedResourceUrlMap 返回值被丢弃，435-446 仍发起 resolve → 移除无消费者的解析调用（字幕 URL 直接使用或按需解析并消费）
2. **[一般] "默认字幕" Switch 无法关闭**：panel.tsx:1614-1623 onChange 仅在 checked===true 时写配置 → 允许关闭（checked false 也写，default 全 false 合法）
3. **[轻微] focus-visible outline none**（view.tsx:43-45）→ 恢复可见焦点环（2px rgba(10,132,255,0.6)）
4. **[轻微] 封面解析等待期空态闪烁**：view.tsx:247-254, 494-497 → 解析中显示骨架占位而非"封面暂时不可用"错误文案
5. **[轻微] 死文案清理**：messages.ts:9-11,16-21,23-33 的 video.editor.hero.*、video.editor.preview.*、resources.desc/video_note/cover_note 等无引用 key → 移除
6. **[轻微] 重复工具函数收口**：view.tsx:196-268 与 panel.tsx:551-623 的 resolveResourceUrlWithRetry/getImmediateResourceUrl/URL 解析 → 收口到 src/shared/utils.ts 单份实现
7. **[轻微] 校验错误首条重复**：panel.tsx:1327-1339 Result subTitle 与 ul 全量重复 → 去重（subTitle 显示首条，列表显示其余）
8. **[轻微] getVisibleErrors 过滤 video_file 必填错误**（panel.tsx:541-545）→ 无视频时保留上传区引导提示（若过滤有意保留并说明）

### 渲染 UI
9. poster-shell 圆角 16px → 12px（view.tsx:50）
10. focus 环（同功能3）
11. 空态配 56px 线条图标 + 次级灰说明（view.tsx:540-542）
12. 封面失败/解析中骨架占位（同功能4）

### 编辑面板 UI
13. "默认字幕"开关修复（同功能2）
14. 错误提示去重（同功能7）
15. .chips-video-editor__button 包 antd Button 的样式重叠死代码（panel.tsx:331-353 与 1291-1299）→ 统一 antd Button + token 定制，移除死样式
16. InputNumber 清空即回弹（panel.tsx:1773-1775, 1786-1788）→ 改 onBlur 归一化（输入中间值不即时回弹，失焦后归一）

## 红线
- 卡片格式契约不变（schema 字段、onChange 语义、openResource payload）；manifest/capabilities 不变
- 禁止 import @chips/component-library；禁止 any；禁止 TODO
- 禁止删除文件（移动归档）；只改本仓库

## 验证（全部通过才算完成）
1. npx tsc --noEmit → 0 错误
2. npm test → 全绿（更新受影响的测试断言；建议补"默认字幕关闭""字幕无多余解析"用例）
3. npm run build → 成功
4. npm run validate → ok
5. 残留扫描：rg "TODO|FIXME|@chips/component-library" src tests → 零命中（归档除外）

## 汇报
- 修复清单（问题→处理方式）
- 验证输出摘要
- 遗留疑问（若有）
