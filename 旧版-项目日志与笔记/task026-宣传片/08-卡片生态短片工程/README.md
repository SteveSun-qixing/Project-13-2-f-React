# 卡片生态短片工程

本工程用于制作《信息，有了自己的形状》卡片生态宣传片。

技术路径：

1. 使用 HTML 页面承载渲染入口。
2. 使用 Canvas 2D 绘制卡片、字幕、信息碎片和概念 UI。
3. 使用 Three.js WebGLRenderer 承载最终画布纹理并输出单一视频画布。
4. 使用 Playwright 打开页面，通过 `canvas.captureStream(25)` 录制无声 WebM。
5. 使用 macOS `say` 生成中文旁白，Node 合成音乐底和轻系统音，再用 ffmpeg 混音与封装。

常用命令：

```bash
npm install
npx playwright install chromium
npm run render:preview
npm run render:video
npm run audio
npm run mux
npm run frames
```

主输出：

`dist/chips_card_ecosystem_1920x1080_25fps_h264.mp4`

说明：

1. 当前默认输出为 `1920x1080 / 25fps` 发布预览母版，工程参数支持提高到 4K，但完整 4K 渲染耗时会显著增加。
2. 片中图片和视频封面均为程序化绘制素材，没有使用第三方品牌、真实软件界面或外部图片。
3. 生图密钥不写入工程；如后续替换为 AI 生成素材，应通过环境变量和素材授权说明管理。
