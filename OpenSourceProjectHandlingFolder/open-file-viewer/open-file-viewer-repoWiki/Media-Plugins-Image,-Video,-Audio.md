# Media Plugins: Image, Video, Audio

> **Relevant source files**
> * [packages/core/src/plugins/audio.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts)
> * [packages/core/src/plugins/cad.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.test.ts)
> * [packages/core/src/plugins/email.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts)
> * [packages/core/src/plugins/image.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.test.ts)
> * [packages/core/src/plugins/image.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.ts)
> * [packages/core/src/plugins/media.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/media.test.ts)
> * [packages/core/src/plugins/model3d.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.test.ts)
> * [packages/core/src/plugins/video.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts)

The Media Plugins suite provides high-performance rendering and interactive control for visual and auditory assets. These plugins leverage browser-native capabilities where possible while extending support for professional and legacy formats through specialized libraries and binary parsing.

## 1. Image Plugin (imagePlugin)

The `imagePlugin` handles a wide array of raster and vector image formats. It includes a custom transformation engine for pan and zoom, HEIC/HEIF conversion, and a binary metadata inspector.

### Supported Formats & Matching

The plugin matches files based on the `image/` MIME prefix or a comprehensive extension whitelist [packages/core/src/plugins/image.ts L5-L25](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.ts#L5-L25)

 It explicitly excludes non-raster engineering formats like DXF or PSD, which are handled by specialized plugins [packages/core/src/plugins/image.ts L26-L37](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.ts#L26-L37)

### Implementation Details

* **HEIC Conversion**: Since browsers do not natively support HEIC, the plugin dynamically imports `heic2any` to convert these files to JPEG Blobs before rendering [packages/core/src/plugins/image.ts L48-L74](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.ts#L48-L74)
* **Interactive Stage**: Images are rendered within an `.ofv-image-stage` [packages/core/src/plugins/image.ts L93-L94](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.ts#L93-L94)  Interaction is managed via `PointerEvents` to support mouse dragging and touch gestures [packages/core/src/plugins/image.ts L166-L194](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.ts#L166-L194)
* **Transformation Logic**: The `updateTransform` function applies CSS transforms for `translate`, `scale`, and `rotate` [packages/core/src/plugins/image.ts L117-L121](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.ts#L117-L121)
* **Metadata Inspection**: The plugin performs binary sniffing to extract format-specific details (e.g., PNG bit depth, SVG viewBox, ICO image counts, AVIF brands) which are displayed in an info bar [packages/core/src/plugins/image.ts L95-L97](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.ts#L95-L97)

### Image Interaction Flow

The following diagram illustrates how the `imagePlugin` bridges user input to the DOM state.

**Image Interaction & State Flow**

```

```

**Sources:** [packages/core/src/plugins/image.ts L5-L200](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.ts#L5-L200)

 [packages/core/src/plugins/image.test.ts L17-L60](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.test.ts#L17-L60)

---

## 2. Video Plugin (videoPlugin)

The `videoPlugin` provides a unified interface for standard video files and adaptive streaming protocols (HLS/MPEG-TS).

### Streaming & Playback

* **HLS Support**: For `.m3u8` files or HLS MIME types, it uses `hls.js`. It checks for native browser support (like Safari) before initializing the library [packages/core/src/plugins/video.ts L107-L122](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts#L107-L122)
* **MPEG-TS/FLV Support**: It utilizes `mpegts.js` to enable playback for `.m2ts` and `.flv` files in browsers that lack native support [packages/core/src/plugins/video.ts L123-L137](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts#L123-L137)
* **Native Playback**: Standard formats (MP4, WebM, Ogg) are assigned directly to the `video.src` [packages/core/src/plugins/video.ts L138-L141](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts#L138-L141)

### Fallback Mechanism

If a format is unsupported or a fatal error occurs during playback, `showTranscodeFallback` is triggered. This displays a UI suggesting conversion to MP4 and providing a direct download link [packages/core/src/plugins/video.ts L70-L96](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts#L70-L96)

### Video Metadata Extraction

The plugin parses binary headers to identify:

* **Codecs**: Detects H.264, H.265, VP9, etc.
* **Resolution**: Extracts width/height from sequence headers.
* **Streaming Info**: Identifies HLS variants and segment counts [packages/core/src/plugins/video.ts L172-L183](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts#L172-L183)

**Sources:** [packages/core/src/plugins/video.ts L31-L170](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts#L31-L170)

 [packages/core/src/plugins/media.test.ts L6-L49](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/media.test.ts#L6-L49)

---

## 3. Audio Plugin (audioPlugin)

The `audioPlugin` focuses on high-fidelity playback and deep metadata inspection for various audio containers.

### Technical Architecture

The plugin wraps the native `<audio>` element but adds a significant parsing layer in `parseAudioInfo` [packages/core/src/plugins/audio.ts L154-L163](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts#L154-L163)

| Parser Function | Targeted Format | Extracted Data |
| --- | --- | --- |
| `parseWaveInfo` | WAV (RIFF) | Sample rate, channels, bit depth, byte rate [packages/core/src/plugins/audio.ts L165-L199](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts#L165-L199) |
| `parseFlacInfo` | FLAC | Stream info block, total samples, bit depth [packages/core/src/plugins/audio.ts L201-L230](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts#L201-L230) |
| `parseId3Mp3Info` | MP3 | ID3v2 tags (v2.2, v2.3, v2.4) and MPEG frames [packages/core/src/plugins/audio.ts L159](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts#L159-L159) |
| `parseOggInfo` | Ogg (Opus/Vorbis) | Page segments and duration [packages/core/src/plugins/audio.ts L159](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts#L159-L159) |

### Implementation of Media Info Bar

The `createAudioInfo` function generates a structured metadata display, showing technical details like sample rate (Hz) and bitrate (kbps) [packages/core/src/plugins/audio.ts L112-L141](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts#L112-L141)

**Sources:** [packages/core/src/plugins/audio.ts L26-L163](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts#L26-L163)

 [packages/core/src/plugins/media.test.ts L51-L183](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/media.test.ts#L51-L183)

---

## 4. Shared Media Components

Both video and audio plugins share a common design pattern for lifecycle management and UI consistency.

### Lifecycle Management

The `PreviewInstance` returned by these plugins ensures that resources are freed when the user switches files:

1. **Revocation**: `revokeObjectUrl` is called to release memory [packages/core/src/plugins/video.ts L164](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts#L164-L164)
2. **Library Cleanup**: `hlsInstance.destroy()` or `mpegtsPlayer.destroy()` are called to stop network requests and buffer processing [packages/core/src/plugins/video.ts L155-L161](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts#L155-L161)
3. **Playback Halt**: Native `pause()` is called to stop audio/video threads [packages/core/src/plugins/audio.ts L84](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts#L84-L84)

### Media Rendering Pipeline

This diagram shows how a media file travels from the core to the rendered DOM.

**Media Rendering Pipeline**

```

```

**Sources:** [packages/core/src/plugins/video.ts L146-L168](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts#L146-L168)

 [packages/core/src/plugins/audio.ts L81-L90](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts#L81-L90)

 [packages/core/src/plugins/image.ts L216-L225](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.ts#L216-L225)