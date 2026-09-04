# Archive & Email Plugins

> **Relevant source files**
> * [packages/core/src/plugins/archive.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.test.ts)
> * [packages/core/src/plugins/archive.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts)
> * [packages/core/src/plugins/audio.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/audio.ts)
> * [packages/core/src/plugins/drawing.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/drawing.test.ts)
> * [packages/core/src/plugins/email.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.test.ts)
> * [packages/core/src/plugins/email.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts)
> * [packages/core/src/plugins/video.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/video.ts)

The Archive and Email plugins enable the exploration and preview of containerized file formats directly within the browser. The `archivePlugin` provides a hierarchical tree navigation interface for compressed packages, while the `emailPlugin` reconstructs structured message views from standard email formats, including support for attachments and HTML body rendering.

## 1. Archive Plugin

The `archivePlugin` handles common compression formats using `JSZip` for ZIP files and `pako` for GZIP decompression. It features a split-pane layout: a sidebar for directory navigation and a main viewport for file metadata or nested file previews.

### 1.1 Supported Formats & Detection

The plugin matches files based on a predefined set of extensions and MIME types.

| Format | Extensions | MIME Types | Engine |
| --- | --- | --- | --- |
| **ZIP** | `.zip` | `application/zip`, `application/x-zip-compressed` | `JSZip` |
| **GZIP** | `.gz`, `.tgz` | `application/gzip`, `application/x-gzip` | `pako` |
| **TAR** | `.tar` | `application/x-tar` | Internal `untar` |
| **Others** | `.rar`, `.7z`, `.bz2`, `.xz` | `application/x-rar-compressed`, `application/x-7z-compressed` | Header Probe Only |

Sources: [packages/core/src/plugins/archive.ts L9-L33](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L9-L33)

 [packages/core/src/plugins/archive.ts L55-L57](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L55-L57)

### 1.2 Archive Navigation Flow

The `render` function orchestrates the decompression and UI construction. If an archive contains nested files, the plugin allows "in-archive" previewing by recursively invoking the viewer's plugin matching logic on extracted `Blob` data.

#### Data Flow: Archive Entry Preview

1. **Extraction**: When a user selects a file in the sidebar, `entry.read()` is called to get an `ArrayBuffer` [packages/core/src/plugins/archive.ts L40](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L40-L40)
2. **Normalization**: The buffer is converted to a `Blob` and passed to `normalizeFile` to create a new `PreviewFile` object [packages/core/src/plugins/archive.ts L255-L265](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L255-L265)
3. **Plugin Matching**: The plugin iterates through the registered `plugins` array in the `PreviewContext` to find a match for the nested file [packages/core/src/plugins/archive.ts L273-L275](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L273-L275)
4. **Nested Rendering**: The matched plugin's `render` method is called, targeting the main content area of the archive layout [packages/core/src/plugins/archive.ts L284](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L284-L284)

### 1.3 Archive Header Probing

For formats not yet supported for full decompression (like RAR or 7z), the plugin uses `probeArchiveHeader` to extract basic metadata and file lists without full extraction.

```

```

Sources: [packages/core/src/plugins/archive.ts L72-L123](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L72-L123)

 [packages/core/src/plugins/archive.ts L157-L158](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L157-L158)

## 2. Email Plugin

The `emailPlugin` parses structured communication files. It utilizes `postal-mime` for standard text-based formats and `@kenjiuno/msgreader` for Outlook's binary compound file format.

### 2.1 Implementation Details

The plugin transforms raw file data into a unified `EmailData` interface containing headers, body (Text/HTML), and attachments.

* **EML/MBOX**: Parsed via `PostalMime`. MBOX files are split into individual messages using `splitMboxMessages` [packages/core/src/plugins/email.ts L117-L128](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts#L117-L128)
* **MSG**: Parsed via `MsgReader`. This requires reading the file as an `ArrayBuffer` to handle the binary structure [packages/core/src/plugins/email.ts L60-L64](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts#L60-L64)
* **Security**: HTML bodies are processed via `DOMPurify` to strip scripts and dangerous attributes. External links are forced to `target="_blank"` with `rel="noopener noreferrer"` [packages/core/src/plugins/email.ts L1](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts#L1-L1)  [packages/core/src/plugins/email.test.ts L129-L168](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.test.ts#L129-L168)

### 2.2 Attachment Handling

Attachments are extracted as `Uint8Array` and converted to Object URLs for downloading. The plugin also handles "CID" (Content-ID) inline images by mapping `cid:` URIs in the HTML body to local Blob URLs.

```

```

Sources: [packages/core/src/plugins/email.ts L44-L152](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts#L44-L152)

 [packages/core/src/plugins/email.ts L175-L187](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts#L175-L187)

 [packages/core/src/plugins/email.test.ts L170-L205](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.test.ts#L170-L205)

## 3. Key Classes and Functions

### Archive Management

* **`archivePlugin()`**: Entry point that registers the plugin and defines the `match` logic [packages/core/src/plugins/archive.ts L52-L57](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L52-L57)
* **`untar(buffer)`**: Internal utility to parse the TAR tape format into an array of file entries [packages/core/src/plugins/archive.ts L96](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L96-L96)
* **`renderArchiveLayout`**: Constructs the UI, including the `ofv-archive-sidebar` and the `ofv-archive-main` content area [packages/core/src/plugins/archive.ts L197-L210](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L197-L210)

### Email Management

* **`emailPlugin()`**: Handles format detection for `.eml`, `.msg`, and `.mbox` [packages/core/src/plugins/email.ts L38-L43](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts#L38-L43)
* **`getAttachmentObjectUrl`**: Manages the lifecycle of attachment blobs, ensuring they are revoked when the viewer is destroyed to prevent memory leaks [packages/core/src/plugins/email.ts L53](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts#L53-L53)
* **`splitMboxMessages`**: Regex-based utility to separate concatenated messages in MBOX files [packages/core/src/plugins/email.ts L122](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts#L122-L122)

Sources: [packages/core/src/plugins/archive.ts L52-L210](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.ts#L52-L210)

 [packages/core/src/plugins/email.ts L38-L122](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/email.ts#L38-L122)