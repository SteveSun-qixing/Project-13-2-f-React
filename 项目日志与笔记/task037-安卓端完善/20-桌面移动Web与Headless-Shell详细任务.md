# 桌面、移动、Web 与 Headless Shell 详细任务

## 1. W5 Electron Desktop 薄 Shell

### W5-01 Rust Core daemon 启动与监护

**目标**：Electron 只管理 Desktop Shell/PAL，唯一 Kernel/Services 运行于 Rust Core 子进程。

**实施动作**：

1. 在打包时为 macOS/Windows/Linux 和支持架构捆绑匹配的 Rust Core；
2. Electron 生成随机 endpoint/token，用显式参数启动 Core；
3. 验证子进程绝对路径、代码签名/hash、版本和父进程身份；
4. 实现 ready/health/shutdown 握手、超时、退出码和崩溃报告；
5. 实现有界重启、崩溃循环熔断、单实例和孤儿进程清理；
6. 优雅退出时先阻止新会话，再排空任务与刷盘。

**测试**：Core 启动失败、假造二进制、崩溃重启、快速重复启动、Electron 被 kill、Core 被 kill、系统关机。

**完成判据**：不运行 TypeScript Kernel 时 Desktop Host 仍可完成金链路；任一进程异常不会留下无主写入事务。

### W5-02 Electron <-> Rust 双向 RPC

**实施动作**：实现 Unix domain socket/Windows named pipe adapter，使用 W1-06 framing；支持 Shell->Core route、Core->Shell PAL call、event、stream、cancel、deadline 和 reconnect；每个连接与 Host instance 绑定。

**测试**：伪造客户端、token 重放、Core 重启时未完成请求、大文件流、双向并发和背压。

### W5-03 Desktop PAL 收敛

**实施动作**：将 BrowserWindow/surface、dialog/selection、shell/transfer、file association、protocol、clipboard、notification、tray、shortcut、screen/power、offscreen render 收敛到 Electron adapter；每项实现 Rust PAL conformance suite。

**边界**：只有 Desktop PAL 可 import Electron/Node；app/card/layout/module 和 Rust Core 禁止直连。

### W5-04 Bridge/preload 迁移

**实施动作**：保留 `window.chips.*` 公共形状；preload 只做 envelope、requestId、订阅和错误归一；Electron 主进程根据 `webContents/session/surface` 重建 caller，然后转发 Rust Kernel。

**安全门禁**：`nodeIntegration: false`、`contextIsolation: true`、sandbox、CSP、navigation/window-open/permission handlers、受控 protocol；禁止对不可信远程内容注入高权限 Bridge。

### W5-05 Desktop resource/surface/offscreen

**动作**：将 `chips-render:` 等受控协议改为消费 Rust ResourceHandle；surface 状态与 Rust session 双向同步；HTML->PDF/image 只是 Desktop PAL 的 offscreen implementation，不再是 module 直接 BrowserWindow。

### W5-06 Desktop 三系统金链路

**链路**：安装/更新 CPK -> 打开 card/box -> CardViewer -> card/layout/theme -> Bridge -> 编辑会话 -> module 导出 -> 关闭恢复。

**设备**：Windows x64/arm64、macOS arm64/x64（依支持政策）、Linux 正式发行目标与 X11/Wayland 策略。

**完成判据**：三系统运行同一 Rust Core corpus；关键 UI screenshot/DOM/interaction golden 通过；签名安装包可升级。

## 2. W6 Android Tauri 2 + Kotlin

### W6-01 Android 正式工程

**动作**：创建 Tauri 2 Android project、Gradle version catalog、applicationId、min/target/compile SDK、JDK/Kotlin/AGP 版本、debug/staging/release flavor、ProGuard/R8、16KB page/ABI 策略、资源与签名入口。

**测试**：空白 Host 不是验收目标；CI 必须构建、安装并启动内置诊断 surface，诊断 surface 显示真实 Rust Core 健康状态。

### W6-02 Rust Core 与移动生命周期

**动作**：将 Core 作为 Android 进程内 Rust library；定义 Application/Activity/WebView 与 Core 启停顺序；处理 configuration change、background、low memory、process death、restore token、deep-link cold start 和升级后恢复。

**完成判据**：正确性不依赖进程常驻；“不调用 onDestroy 直接杀进程”后重启能恢复最近已提交状态。

### W6-03 Kotlin Android PAL

**分面任务**：

- storage：internal/app-specific/cache 与 quota；
- selection：`ACTION_OPEN_DOCUMENT/CREATE_DOCUMENT/OPEN_DOCUMENT_TREE`；
- transfer：share sheet、external open、export；
- association：file intent、deep link、share target；
- credential：Android Keystore 和加密引用；
- systemUi：clipboard、notification、haptics、screen；
- background：WorkManager、foreground service/user-initiated transfer 的明确选择；
- network/device：连接状态、电量/热状态仅在需要时暴露；
- surface：fullscreen/route/tab/sheet/modal，`window/tray/globalShortcut` 正式 unsupported。

**测试**：使用 instrumentation 运行统一 PAL conformance suite；每个 unsupported 精确断言错误码与 capability snapshot。

### W6-04 Android WebView Resource/Bridge/Security

**动作**：使用 AndroidX WebKit/asset loader 建立 Host 私有 HTTPS-like origin；映射插件入口、卡片文档、主题、字体和 resource handle；使用受控 Web message channel；根据 WebView instance/origin/session 重建 caller。

**安全设置**：禁止危险 file access/universal access，限制 mixed content、navigation、popup、download、debug、safe browsing、media permission；远程网页使用无特权 profile。

**测试**：iframe 伪造、origin 切换、会话过期、远程导航、恶意 `postMessage`、XSS 后越权、资源越界与 WebView renderer crash。

### W6-05 Android 系统集成

**动作**：实现 URI permission 持久化、导入内部 workspace、原位保存可能性判断、Intent 冷/热启动路由、返回键/gesture、share in/out、notification tap、background job 恢复和权限申请。

### W6-06 Android CardViewer 金链路

**必测流程**：安装 APK -> 首启动 -> picker 选 `.card` -> 导入/校验 -> 调起 CardViewer -> richtext/image/web/media 样本 -> card/layout/theme -> 资源交互 -> 进后台 -> 旋转 -> 杀进程 -> 恢复 -> 导出/分享。

**完成判据**：模拟器和至少两家真机通过；无路径泄露、无丢失、无假支持。

### W6-07 Android 完整 Host

**动作**：接入编辑引擎、箱子布局、全部认证 card、portable modules、社区上传/下载、EcoSettingsPanel 和插件治理；验证长时间编辑、大文档、低内存与弱网。

## 3. W7 iOS Tauri 2 + Swift

### W7-01 iOS 正式工程

建立 bundle ID、deployment target、entitlements、privacy manifest、debug/staging/release、签名与 TestFlight 构建；集成同一 Rust Core。

### W7-02 Swift PAL/WKWebView

映射 document picker/security-scoped resource、share、URL scheme/universal link、Keychain、notification、background task、surface 和 WKWebView content world/message handler/custom resource scheme；处理 WebContent process 崩溃与 app termination 恢复。

### W7-03 iOS 金链路

复用 Android 文档/插件 corpus 与公共 E2E 语义，增加 iPhone/iPad、新旧支持系统、内存压力、分享入口、文件授权失效和 TestFlight 签名校验。

## 4. W8 Headless 与 Web

### W8-01 Rust HeadlessHostShell

**动作**：提供 library 和 binary 入口；实现 workspace/config/log/network/credential/background/offscreen capability；surface/selection/system UI 正式 unsupported；支持 graceful signal、health/readiness 和 worker job。

**完成判据**：社区服务器不再 import TypeScript Host 业务实现；同一 card/box/module corpus 通过。

### W8-02 WebHostShell 与 Web PAL

**动作**：实现 browser storage/file picker/download/share/clipboard/network 的 capability-aware adapter；无法支持的本地系统能力显式拒绝；卡片插件继续运行在 Web isolation boundary。

### W8-03 Remote Host transport

实现用户显式授权的 Web->Headless/Desktop Host 传输，覆盖 TLS、device/session binding、scope、revocation、reconnect、stream 和 audit；远程路由只能访问可公开 capability，不能把本地 Bridge 全量暗中暴露。
