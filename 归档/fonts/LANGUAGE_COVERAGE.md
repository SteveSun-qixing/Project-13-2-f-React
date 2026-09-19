# 字体语言覆盖映射（阶段04任务09冻结矩阵）

- 覆盖策略：UI 主字体 + 脚本主字体 + 回退字体。
- 矩阵约束：固定 12 语言；`BCP47 locale` 必须唯一；主题绑定字段仅允许 `font.family.*`。
- 运行时联动：由 `language.changed` 触发语言命中后，按下表链路解析字体。

| 语言 | BCP47 locale | 主字体文件 | 回退字体链 | 主题 token 绑定 |
| --- | --- | --- | --- | --- |
| English (英语) | `en-US` | `robotoflex/RobotoFlex[...].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.en-US -> font.family.ui -> font.family.fallback` |
| 简体中文 (Chinese Simplified) | `zh-CN` | `notosanssc/NotoSansSC[wght].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.zh-CN -> font.family.text.zhHans -> font.family.fallback` |
| 繁体中文 (Chinese Traditional) | `zh-TW` | `notosanstc/NotoSansTC[wght].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.zh-TW -> font.family.text.zhHant -> font.family.fallback` |
| Español (西班牙语) | `es-ES` | `robotoflex/RobotoFlex[...].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.es-ES -> font.family.ui -> font.family.fallback` |
| Français (法语) | `fr-FR` | `robotoflex/RobotoFlex[...].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.fr-FR -> font.family.ui -> font.family.fallback` |
| Deutsch (德语) | `de-DE` | `robotoflex/RobotoFlex[...].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.de-DE -> font.family.ui -> font.family.fallback` |
| 日本語 (日语) | `ja-JP` | `notosansjp/NotoSansJP[wght].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.ja-JP -> font.family.text.ja -> font.family.fallback` |
| 한국어 (韩语) | `ko-KR` | `notosanskr/NotoSansKR[wght].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.ko-KR -> font.family.text.ko -> font.family.fallback` |
| Português (葡萄牙语) | `pt-PT` | `robotoflex/RobotoFlex[...].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.pt-PT -> font.family.ui -> font.family.fallback` |
| Português (Brasil) (巴西葡语) | `pt-BR` | `robotoflex/RobotoFlex[...].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.pt-BR -> font.family.ui -> font.family.fallback` |
| Русский (俄语) | `ru-RU` | `notosans/NotoSans[wdth,wght].ttf` | `robotoflex/RobotoFlex[...].ttf -> system-ui` | `font.family.locale.ru-RU -> font.family.text.cyrillic -> font.family.fallback` |
| Italiano (意大利语) | `it-IT` | `robotoflex/RobotoFlex[...].ttf` | `notosans/NotoSans[wdth,wght].ttf -> system-ui` | `font.family.locale.it-IT -> font.family.ui -> font.family.fallback` |
