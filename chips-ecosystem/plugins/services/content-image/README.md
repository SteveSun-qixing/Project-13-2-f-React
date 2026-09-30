# 图像内容处理服务 `chips.service.content-image`

> 角色：`service`；插件 ID：`chips.service.content-image`；版本：`0.1.0`
> 归属服务名：`content-image`（04-能力契约规范 §8.4 canonical 登记表，图像族三能力的唯一提供方）

本包是《04-能力契约规范》§8.4 canonical 登记表在册的图像内容处理服务包：图像族十三项能力里的
`content-image.normalize`／`content-image.transcode`／`content-image.pick-colors` 三项，其提供方
唯一钉为本插件 ID。本包不注册 Bridge 能力、不进入 R19 权限映射（§8.1、§8.5），消费方经
`ctx.inject` 注入后按类型化接口调用；服务注入不经 Bridge 权限判定（§8.4 权限映射列＝无）。

## 能力声明面（只声明已实现，契约先行不冒充接线）

《02-插件清单规范》§7 与 `packages/cli/src/artifacts/manifest.ts` 一致规定：`capabilities` 只允许
`basecard` / `boxlayout` 声明，`service` 角色禁止——因此本包的能力声明面是**清单描述 + 随包描述符 +
实际注册的服务面**三处，全部按实收窄到已实现的一能力：

| 能力 ID                     | 原子操作     | 契约（`assets/schemas/`） | 描述符实例        | 服务面已注册 | 状态                             |
| --------------------------- | ------------ | ------------------------- | ----------------- | ------------ | -------------------------------- |
| `content-image.pick-colors` | `pickColors` | 输入 + 输出               | `descriptor.json` | 是           | **已实现**（OKLab 加权 k-means） |
| `content-image.normalize`   | `normalize`  | 输入 + 输出（先行）       | 否                | 否           | **契约已先行、实现缺位**         |
| `content-image.transcode`   | `transcode`  | 输入 + 输出（先行）       | 否                | 否           | **契约已先行、实现缺位**         |

`normalize` / `transcode` 两能力的输入→输出形状按《04.23》§8.4 表逐列钉形（2020-12、
`additionalProperties: false` 封闭对象、二进制承载走 `x-chips-binary`），并由
`tests/contract.test.ts` 做形状锁测；两能力的实现来源（旧 Cover 归一面与查看器转码面）待
W4 §9.2 勘查定位后由后续 lane 接入，届时同包扩操作面并补描述符实例（W4 §9.1 并行闸 1：
同包 manifest 与 lockfile importer 单路独占）。清单与描述符里出现未实现能力＝假接线，禁止。

## 目录结构

```text
content-image/
├── manifest.yaml                       # 唯一权威清单（service 角色，空权限）
├── package.json                        # 工作区包 @chips/service-content-image
├── tsconfig.json                       # 继承仓库 tsconfig.base.json（三级 extends）
├── vite.shared.ts                      # 构建期红线守卫（禁 UI 库 / Node / Electron / 原生图像库）
├── vite.main.config.ts                 # 入口构建 → dist/index.js（自包含 ESM，无 render.js）
├── vitest.config.ts                    # node 环境测试配置
├── src/types.ts                        # 契约类型面（输入 / 输出 / 端口 / 描述符）
├── src/descriptor.ts                   # canonical 标识三元组、描述符与限额常量
├── src/errors.ts                       # IMAGE_* 错误面（ChipsError）
├── src/bytes.ts                        # 图像字节归一与缓存键
├── src/color-analysis.ts               # 色彩分析核心（纯函数）
├── src/pixel-source.ts                 # 像素来源端口、形状校验、样本缓存、未绑定 fail-closed
├── src/service.ts                      # pickColors 编排（并发闸门 + 两级缓存 + 取消安全点）
├── src/plugin.ts                       # IServicePlugin 入口对象（注册 content-image 服务）
├── src/index.ts                        # 构建入口与拆分导出
├── assets/schemas/                     # 提供方契约包（三能力六件 + 描述符实例与 schema）
│   ├── pick-colors.input.schema.json
│   ├── pick-colors.output.schema.json
│   ├── normalize.input.schema.json     # 契约先行，实现缺位
│   ├── normalize.output.schema.json    # 契约先行，实现缺位
│   ├── transcode.input.schema.json     # 契约先行，实现缺位
│   ├── transcode.output.schema.json    # 契约先行，实现缺位
│   ├── descriptor.schema.json          # §8.3 描述符字段级契约（2020-12）
│   └── descriptor.json                 # pick-colors 描述符实例（唯一在册登记实例）
└── tests/                              # 单元与契约测试（6 文件）
```

## 常用命令

```bash
export PATH="$HOME/.volta/bin:$PATH"           # pnpm 9.15.0（闸门口径）
pnpm --filter @chips/service-content-image run typecheck
pnpm --filter @chips/service-content-image run lint
pnpm --filter @chips/service-content-image run test
pnpm --filter @chips/service-content-image run build
pnpm --filter @chips/service-content-image run package    # 产出 dist/content-image-<version>.cpk
node tools/gates/check-entries.mjs plugins/services/content-image
```

## 已实现能力契约：`content-image.pick-colors`

输入 `pickColors(input, call?)`：

| 字段          | 类型                       | 约束            | 说明                                                |
| ------------- | -------------------------- | --------------- | --------------------------------------------------- |
| `image`       | 二进制（`x-chips-binary`） | 必填、≤ 64 MiB  | 图像字节；禁内联 base64（§8.3 约束 5）              |
| `sampleSize`  | integer                    | 48–160，缺省 96 | 采样边长；非法值归一                                |
| `format`      | string                     | 规范化名提示    | 缺省由解码端口嗅探                                  |
| `sourceKey`   | string                     | ≤ 512           | 消费方给出的来源标识，仅作 LRU 缓存键；缺省时不缓存 |
| `call.signal` | `AbortSignal`              | 可选            | 取消通道（§8.3 约束 2）                             |

输出：`backgroundColor` / `accentColor`（十六进制）、`palette`（2–8 项，首项背景、次项强调）、
`metadata`（`algorithm` / `image` / `sample` 三段，含 Alpha 覆盖与簇数诊断）。

错误面：`IMAGE_INPUT_UNSUPPORTED`、`IMAGE_DECODE_FAILED`、`IMAGE_EMPTY`、`IMAGE_ANALYSIS_FAILED`
与通道码 `BRIDGE_CANCELLED`（`ChipsError`，`message` 简体中文，`details` 只含标量、不含输入原文、
凭证与内部路径）。

## 契约先行能力

- `content-image.normalize`：图像字节（TIFF 等真实格式）→ PNG 字节与像素尺寸。
  输入 `{ image(二进制), format? }`，输出 `{ image(二进制), format = "png", width, height }`。
- `content-image.transcode`：图像字节（按支持矩阵）→ 目标格式与尺寸。
  输入 `{ image(二进制), targetFormat, format?, maxWidth?, maxHeight? }`，
  输出 `{ image(二进制), format, width, height }`。

两能力的格式选项语义与支持矩阵由提供方在实现波次随契约发布（§8.4 表末注），本包只在契约面钉
输入→输出形状，不承诺任何未证实的格式集。

## 在册缺位（如实登记，不是降级实现）

| 缺位项                         | 事实                                                                                                                     | 当前收口                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 图像字节 → RGBA 像素的解码供给 | `content-image.normalize` / `transcode` 实现缺位；`sharp` 属未裁新依赖且携带原生载荷（违 R11、§8.3 约束 5）              | `src/pixel-source.ts` 的 `createUnboundDecodeEngine()`：调用即以 `IMAGE_DECODE_FAILED` + `details.reason=PIXEL_SOURCE_UNBOUND` 拒绝；生产装配（`src/plugin.ts`）使用该未绑定端口，不自建图像读取通道 |
| 来源格式支持矩阵               | 矩阵由解码提供方定义                                                                                                     | `descriptor.json` 的 `sourceFormats: []`（不承诺未证实格式集）                                                                                                                                       |
| 作业进度上报                   | `IServiceContext` 成员总表（10 §3.2）无 `job` / `reportProgress` 面                                                      | 以 `ctx.logger` 诊断替代；旧 `COLOR_PICKER_*` 七码与旧 `file.stat` / `file.read` 通道按 §8.4「已替代」表下线                                                                                         |
| 契约随包发布链路               | 工单059 在册未裁：《04.23》:52 书写 `contracts/`，而 pack 根白名单只含 `manifest.yaml` / `render.js` / `dist` / `assets` | 沿用在册母型（`plugins/layouts/grid`）落 `assets/schemas/`，**契约随包发布链路未验证**（未实测 `.cpk` 成员集是否被消费方按契约包读取），不把任何一种落点当作已裁定结论                               |
| 插件 ID 回写《09》目录         | `09-官方插件与应用目录` 仍记旧 `chips.module.chips.colorpicker` 与 `image.color.pick`（状态「待实现」）                  | 代码面按 §8.4 canonical 落定；文档回写不在本路写面（禁改文档库），由主智能体合流时统一回写                                                                                                           |

## 规范入口

《04-能力契约规范》§八（内容处理服务能力：§8.2 标识文法、§8.3 描述符与原子操作约束、§8.4 canonical
登记表、§8.5 调用与权限边界、§8.6 错误码）、《06-服务插件开发指南》§七、《10-服务插件接口》§2/§3、
《02-插件清单规范》§7、《插件包格式》、《TypeScript 编码规范》《测试规范》。
