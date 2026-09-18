# xlsx-sidecar 引擎二进制来源说明

本目录存放 `office.engine.*` 服务（`Chips-Host/packages/xlsx-engine-service`）所依赖的
`xlsx-sidecar` 原生引擎二进制。该二进制以 stdio JSON 行协议与 Host 通信，负责 xlsx
工作簿的打开、懒加载读取、公式重算与 zip 重组保存等原生计算职责。

## 来源

- 上游项目：GenOffice（Apache-2.0 License）
- 源码路径：`OpenSourceProjectHandlingFolder/GenOffice/genoffice-main/apps/sheets/native/xlsx-engine/`
- 语言：Rust（crate 名 `xlsx-sidecar`，bin 目标 `xlsx-sidecar`）
- 协议版本：`version: 1`（请求 `{version, requestId, command, ...}`，响应
  `{version, requestId, ok, result?, error?}`，JSON Lines）

## 已分发平台目标

| 目录 | 平台 / 架构 | 构建目标 triple |
|---|---|---|
| `darwin-arm64/xlsx-sidecar` | macOS Apple Silicon | `aarch64-apple-darwin`（宿主默认目标） |
| `darwin-x64/xlsx-sidecar` | macOS Intel | `x86_64-apple-darwin` |

尚未分发的目标（需在对应平台 CI 上构建，见下）：

| 平台 / 架构 | 构建目标 triple |
|---|---|
| Windows x64 | `x86_64-pc-windows-msvc`（产物名 `xlsx-sidecar.exe`） |
| Linux x64 | `x86_64-unknown-linux-gnu` |

## 构建命令

macOS（宿主默认目标）：

```bash
cd OpenSourceProjectHandlingFolder/GenOffice/genoffice-main/apps/sheets/native/xlsx-engine
cargo --config 'source.crates-io.replace-with="rsproxy"' \
      --config 'source.rsproxy.registry="sparse+https://rsproxy.cn/index/"' \
      build --release --bin xlsx-sidecar
cp target/release/xlsx-sidecar <Chips-Host>/resources/engines/xlsx-sidecar/darwin-arm64/xlsx-sidecar
```

macOS Intel 交叉构建：

```bash
rustup target add x86_64-apple-darwin
cargo --config 'source.crates-io.replace-with="rsproxy"' \
      --config 'source.rsproxy.registry="sparse+https://rsproxy.cn/index/"' \
      build --release --target x86_64-apple-darwin --bin xlsx-sidecar
cp target/x86_64-apple-darwin/release/xlsx-sidecar \
   <Chips-Host>/resources/engines/xlsx-sidecar/darwin-x64/xlsx-sidecar
```

Windows x64 / Linux x64：在对应平台的 CI 机器（或容器）上安装 Rust 工具链后执行：

```bash
# Windows x64（在 Windows 上原生构建，产物为 xlsx-sidecar.exe）
rustup target add x86_64-pc-windows-msvc
cargo build --release --target x86_64-pc-windows-msvc --bin xlsx-sidecar
# 复制 target/x86_64-pc-windows-msvc/release/xlsx-sidecar.exe 到 win32-x64/

# Linux x64（在 Linux 上原生构建）
rustup target add x86_64-unknown-linux-gnu
cargo build --release --target x86_64-unknown-linux-gnu --bin xlsx-sidecar
# 复制 target/x86_64-unknown-linux-gnu/release/xlsx-sidecar 到 linux-x64/
```

上述「构建 + 复制」流程已固化为脚本：`Chips-Host/scripts/build-xlsx-sidecar.mjs`
（支持 `--target <triple> --out <平台目录>` 参数）。

## 二进制定位顺序（xlsx-engine-service）

1. 环境变量 `CHIPS_XLSX_SIDECAR` 指定的可执行文件路径；
2. `Chips-Host/resources/engines/xlsx-sidecar/<platform>-<arch>/xlsx-sidecar(.exe)`，
   其中 `<platform>-<arch>` 取 `process.platform` + `process.arch`
   （`darwin-arm64`、`darwin-x64`、`win32-x64`、`linux-x64`）；
3. `PATH` 中的 `xlsx-sidecar`。

均未命中时，`office.engine.*` 路由返回 `ENGINE_BINARY_MISSING` 结构化错误。

## 版本与许可证

- 上游许可证：Apache-2.0（GenOffice 仓库 `LICENSE`）；
- 构建版本：与 `OpenSourceProjectHandlingFolder/GenOffice` 当前工作区源码一致
  （构建日期 2026-09-04，协议版本 1）；
- 本目录下的二进制属于构建产物，不入库分发历史由 `SOURCE.md` 与
  `scripts/build-xlsx-sidecar.mjs` 共同追溯。
