# Documentation Site

> **Relevant source files**
> * [doc/index.html](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html)
> * [doc/package.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/package.json)
> * [doc/src/main.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts)
> * [doc/src/style.css](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css)
> * [packages/core/src/detect.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/detect.test.ts)

The Documentation Site is the primary public-facing interface for the Open File Viewer project. Located in the `doc/` directory, it serves as a live demonstration platform, a technical manual, and a benchmark for the library's capabilities. It is built using **Vite** and **Vanilla TypeScript**, ensuring that the documentation itself remains lightweight and framework-agnostic, mirroring the core library's philosophy.

### Architectural Overview

The documentation site bridges the gap between raw code entities and user-facing features. It manages an interactive playground, a multi-language i18n system, and a comprehensive styling system that simulates real-world application environments.

#### Site Lifecycle and Code Mapping

The following diagram illustrates how the documentation site's boot process maps to specific code entities and states.

**Site Initialization Flow**

```

```

**Sources:** [doc/index.html L15-L31](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html#L15-L31)

 [doc/src/main.ts L1-L22](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L1-L22)

 [doc/src/style.css L103-L105](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L103-L105)

---

### Core Components

#### 1. Interactive Playground

The playground is the centerpiece of the documentation. It allows users to drop local files or enter URLs to see the viewer in action. It utilizes the `createViewer` API from `@open-file-viewer/core` to demonstrate multi-file queues and responsive container handling.

* **File Handling:** Supports `File`, `Blob`, and `URL` inputs, which are processed via `normalizeFile` [packages/core/src/detect.test.ts L11-L12](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/detect.test.ts#L11-L12)
* **Sample Generation:** Includes in-memory generators for Office formats and ZIP archives to provide immediate "out-of-the-box" previews without external assets.

For implementation details on the rendering lifecycle and sample generators, see **[Playground & Demo System (#5.1)](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/Playground & Demo System (#5.1))**.

#### 2. i18n System

The site features a robust internationalization system defined in `doc/src/main.ts`. It manages translations for both English (`en`) and Chinese (`zh`) [doc/src/main.ts L35](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L35-L35)

| Feature | Implementation |
| --- | --- |
| **Translation Data** | `translations` record mapping keys to language strings [doc/src/main.ts L49-L215](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L49-L215) |
| **DOM Binding** | Uses `data-i18n` attributes in HTML for reactive text replacement. |
| **State Persistence** | Saves preferred language in `localStorage`. |

**Sources:** [doc/src/main.ts L49-L215](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L49-L215)

#### 3. Styling & Theming

The site uses a custom CSS design system that supports light and dark modes via `data-site-theme` [doc/src/style.css L26](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L26-L26)

 It includes:

* **Browser Simulation:** A UI wrapper that mimics a browser window to show the viewer in a constrained environment.
* **Responsive Breakpoints:** Optimized layouts for mobile, tablet, and desktop viewing.
* **Syntax Highlighting:** Integration with **Prism.js** for code snippets in the API reference [doc/src/main.ts L25-L30](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L25-L30)

For the full CSS variable specification and layout details, see **[Documentation Site UI & Styling (#5.2)](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/Documentation Site UI & Styling (#5.2))**.

---

### Integration with Core Library

The documentation site acts as the ultimate consumer of the `@open-file-viewer/core` package. It imports all available plugins to demonstrate the "Batteries Included" philosophy.

**Plugin Registration Mapping**

```

```

**Sources:** [doc/src/main.ts L1-L22](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L1-L22)

 [doc/package.json L11-L14](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/package.json#L11-L14)

### Sub-Pages

* **[Playground & Demo System (#5.1)](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/Playground & Demo System (#5.1))**: Detailed look at the `renderViewer` lifecycle, responsive height syncing, and sample file creation.
* **[Documentation Site UI & Styling (#5.2)](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/Documentation Site UI & Styling (#5.2))**: Deep dive into the CSS architecture, theme switching, and the "boot state" management.