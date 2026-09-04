# Documentation Site UI & Styling

> **Relevant source files**
> * [doc/about.html](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/about.html)
> * [doc/api.html](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/api.html)
> * [doc/index.html](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html)
> * [doc/src/style.css](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css)

The documentation site for Open File Viewer serves as both a marketing landing page and a technical reference. It utilizes a custom CSS design system that supports dark mode, responsive layouts, and specialized UI components like the browser-shell simulation and the playground interface.

## Design System & Theming

The site uses a CSS custom property-based design system defined in `doc/src/style.css`. It implements a dual-theme architecture (light/dark) toggled via the `data-site-theme` attribute on the root `<html>` element.

### Theme Tokens

The system defines core tokens for backgrounds, surfaces, text, and brand colors.

| Token | Light Value (Default) | Dark Value (`[data-site-theme="dark"]`) |
| --- | --- | --- |
| `--bg` | `#ffffff` [doc/src/style.css L3](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L3-L3) | `#080912` [doc/src/style.css L28](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L28-L28) |
| `--surface` | `#ffffff` [doc/src/style.css L5](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L5-L5) | `#141722` [doc/src/style.css L30](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L30-L30) |
| `--text` | `#111827` [doc/src/style.css L7](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L7-L7) | `#f9fafb` [doc/src/style.css L32](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L32-L32) |
| `--brand` | `#7c5cff` [doc/src/style.css L14](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L14-L14) | `#a891ff` [doc/src/style.css L39](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L39-L39) |
| `--code-bg` | `#10131c` [doc/src/style.css L20](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L20-L20) | `#020617` [doc/src/style.css L45](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L45-L45) |

### Theme Initialization & Switching

The theme is initialized via an inline script in the `<head>` of HTML files to prevent Flash of Unstyled Content (FOUC). It checks `localStorage` for the `ofv-site-theme` key [doc/index.html L15-L30](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html#L15-L30)

**Sources:** [doc/src/style.css L1-L49](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L1-L49)

 [doc/index.html L15-L31](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html#L15-L31)

 [doc/api.html L15-L31](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/api.html#L15-L31)

## Boot State Management

The site implements a "boot" lifecycle to manage visibility during initial asset loading.

1. **Loading State**: The root element is marked with `data-site-boot="loading"` [doc/index.html L18](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html#L18-L18)
2. **Visibility Control**: While loading, the `body` is set to `visibility: hidden` [doc/src/style.css L103-L105](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L103-L105)
3. **Animation Suppression**: All animations and transitions are disabled during this state to ensure a clean entrance [doc/index.html L57-L62](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html#L57-L62)
4. **Timeout Safety**: A 1600ms timeout forces the site to show if the loading state is not cleared [doc/index.html L25-L29](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html#L25-L29)

**Sources:** [doc/index.html L15-L31](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html#L15-L31)

 [doc/src/style.css L103-L105](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L103-L105)

 [doc/index.html L53-L63](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html#L53-L63)

## Visual Effects & Animations

The landing page features complex background effects driven by CSS animations.

### Background Layering

The `body` element uses multiple background layers, including linear and radial gradients, to create a depth effect [doc/src/style.css L91-L97](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L91-L97)

* **Grid Drift**: A pseudo-element `::before` creates a drifting background grid using `background-grid-drift` animation [doc/src/style.css L116-L130](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L116-L130)
* **Aurora & Scan**: A pseudo-element `::after` creates a scanning light effect (`background-scan`) and a pulsing aurora effect (`background-aurora`) [doc/src/style.css L138-L166](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L138-L166)

### UI Component Styling

* **Site Header**: Uses `backdrop-filter: blur(18px)` and a sticky position [doc/src/style.css L235-L249](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L235-L249)
* **Icon System**: A global SVG sprite is used for all UI icons, with styling for stroke and fill behavior [doc/src/style.css L55-L71](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L55-L71)

**Sources:** [doc/src/style.css L91-L217](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L91-L217)

 [doc/src/style.css L234-L258](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L234-L258)

 [doc/index.html L67-L161](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/index.html#L67-L161)

## Layout Systems

The documentation site employs several specialized layouts for different sections.

### Browser Shell Simulation

The `.browser-shell` component simulates a desktop browser environment to showcase the viewer.

* **Header**: Contains window controls (dots) and a mock address bar [doc/src/style.css L487-L515](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L487-L515)
* **Responsive Behavior**: Adjusts padding and border-radius based on viewport width [doc/src/style.css L460-L485](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L460-L485)

### Playground Layout

The interactive playground uses a shell-within-a-shell approach.

* **Container**: `.playground-shell` provides a high-contrast container for the interactive demo [doc/src/style.css L667-L680](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L667-L680)
* **Viewer Integration**: The viewer is mounted inside `.playground-viewer`, which is styled to take full height [doc/src/style.css L738-L745](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L738-L745)

### API Documentation Layout

The `api.html` page uses a sidebar-driven layout.

* **Grid System**: `.api-doc-layout` uses a grid with a fixed-width sidebar and flexible content area [doc/src/style.css L1138-L1145](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L1138-L1145)
* **Sticky Sidebar**: The `.api-sidebar` stays fixed while scrolling the documentation [doc/src/style.css L1147-L1160](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L1147-L1160)

**Sources:** [doc/src/style.css L460-L550](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L460-L550)

 [doc/src/style.css L667-L750](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L667-L750)

 [doc/src/style.css L1138-L1170](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L1138-L1170)

 [doc/api.html L158-L160](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/api.html#L158-L160)

## Code Entity Association

The following diagram maps the UI visual components to their CSS classes and HTML structures.

### UI to Code Mapping

```

```

**Sources:** [doc/src/style.css L234](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L234-L234)

 [doc/src/style.css L460](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L460-L460)

 [doc/src/style.css L1220](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L1220-L1220)

 [doc/api.html L143](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/api.html#L143-L143)

### Responsive Breakpoint Pipeline

The site uses standard media queries to adapt the UI for mobile and tablet devices.

```

```

**Sources:** [doc/src/style.css L239](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L239-L239)

 [doc/src/style.css L1290-L1350](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L1290-L1350)

## Syntax Highlighting Tokens

The site includes custom syntax highlighting styles for code blocks, specifically tailored for the technical documentation and API examples.

* **Base Tokens**: Defines colors for keywords, strings, comments, and functions [doc/src/style.css L1220-L1250](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L1220-L1250)
* **Theme Integration**: The highlighting tokens shift based on the global `data-site-theme` to maintain contrast [doc/src/style.css L1255-L1280](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L1255-L1280)
* **Gutter Styling**: The code gutter uses specific variables (`--code-gutter`) for line numbers [doc/src/style.css L22](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L22-L22)

**Sources:** [doc/src/style.css L20-L22](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L20-L22)

 [doc/src/style.css L45-L47](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L45-L47)

 [doc/src/style.css L1220-L1280](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/style.css#L1220-L1280)