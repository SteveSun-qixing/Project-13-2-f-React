# User Interface

> **Relevant source files**
> * [index.html](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html)
> * [manifest-disabled.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/manifest-disabled.json)
> * [src/css/layout.css](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css)
> * [src/js/core/base-gui.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js)

## Purpose

This document provides a comprehensive overview of the miniPaint user interface system, including its layout structure, component hierarchy, initialization process, and how users interact with various UI elements. For information about specific tools functionality, see [Tools](/viliusle/miniPaint/4-tools), and for dialog implementations, see [Dialog System](/viliusle/miniPaint/2.6-dialog-system).

## Overview

The miniPaint interface follows a classic image editor layout with a grid-based structure that adapts to different screen sizes. The interface consists of several key areas: a main menu, tool selection sidebar, central canvas area, context-sensitive submenu, and multiple panels in the right sidebar.

## UI Layout Structure

### HTML Structure Diagram

```

```

Sources: [index.html L33-L102](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L33-L102)

### CSS Grid Layout

The UI layout is implemented using CSS Grid, which provides a responsive and flexible structure:

```

```

Sources: [src/css/layout.css L1-L21](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L1-L21)

 [src/css/layout.css L200-L248](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L200-L248)

 [src/css/layout.css L253-L330](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L253-L330)

 [src/css/layout.css L333-L610](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L333-L610)

 [src/css/layout.css L613-L745](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L613-L745)

## Component Architecture

The UI is managed by a set of JavaScript classes, with `Base_gui_class` serving as the central controller:

```

```

Sources: [src/js/core/base-gui.js L6-L69](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L6-L69)

 [src/js/core/base-gui.js L137-L147](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L137-L147)

## Main UI Components

### 1. Main Menu

The main menu provides access to file operations, editing tools, and application settings. It's rendered at the top of the interface by the `GUI_menu_class`.

Sources: [index.html L35](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L35-L35)

 [src/js/core/base-gui.js L66](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L66-L66)

 [src/js/core/base-gui.js L147](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L147-L147)

### 2. Tool Selection (Left Sidebar)

The left sidebar contains tools for editing images, with each tool represented by an icon. This component is managed by the `GUI_tools_class`.

| Tool | CSS Class | Description |
| --- | --- | --- |
| Selection | `.select, .selection` | Tools for selecting areas |
| Brush | `.brush` | Freehand drawing tool |
| Pencil | `.pencil` | Precise drawing tool |
| Color Picker | `.pick_color` | Tool to select colors from the canvas |
| Eraser | `.erase, .magic_erase` | Tools to erase content |
| Fill | `.fill` | Fill tool for coloring areas |
| Shape | `.shape` | Tools for drawing various shapes |
| Text | `.text` | Tool for adding text |
| Gradient | `.gradient` | Tool for applying gradients |
| Clone | `.clone` | Clone stamp tool |
| Crop | `.crop` | Tool for cropping images |
| Effects | `.blur, .sharpen, .desaturate` | Tools for applying image effects |

Sources: [index.html L45](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L45-L45)

 [src/css/layout.css L253-L330](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L253-L330)

 [src/css/layout.css L305-L323](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L305-L323)

 [src/js/core/base-gui.js L60](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L60-L60)

 [src/js/core/base-gui.js L141](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L141-L141)

### 3. Canvas Area

The central area contains the main canvas where image editing takes place. It includes:

* The main canvas (`#canvas_minipaint`)
* Transparent grid background
* Optional rulers
* Mouse pointer indicator

Sources: [index.html L48-L64](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L48-L64)

 [src/css/layout.css L613-L745](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L613-L745)

 [src/js/core/base-gui.js L239-L270](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L239-L270)

### 4. Tool Attributes Submenu

The submenu area below the main menu displays context-sensitive attributes for the currently selected tool, allowing users to configure tool-specific settings. It also contains the logo and undo button.

Sources: [index.html L37-L43](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L37-L43)

 [src/css/layout.css L200-L248](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L200-L248)

### 5. Right Sidebar Panels

The right sidebar contains several collapsible panels that provide additional functionality:

| Panel | Purpose | DOM ID | Managing Class |
| --- | --- | --- | --- |
| Preview | Shows a small preview of the entire image | `#toggle_preview` | `GUI_preview_class` |
| Colors | Color selection tools | `#toggle_colors` | `GUI_colors_class` |
| Information | Displays information about the current state | `#toggle_info` | `GUI_information_class` |
| Layer Details | Shows details of the selected layer | `#toggle_details` | `GUI_details_class` |
| Layers | Lists all layers and provides layer management | `#layers_base` | `GUI_layers_class` |

Sources: [index.html L66-L90](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L66-L90)

 [src/css/layout.css L333-L610](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L333-L610)

 [src/js/core/base-gui.js L61-L65](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L61-L65)

 [src/js/core/base-gui.js L142-L146](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L142-L146)

## Initialization Process

The UI initialization follows these steps:

```

```

Sources: [src/js/core/base-gui.js L72-L152](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L72-L152)

## Panel Toggle System

The UI implements a toggle system for collapsible panels, allowing users to show/hide specific components:

1. Each toggle element has a `data-target` attribute pointing to the container ID it controls
2. Toggle state is stored in cookies for persistence across sessions
3. Clicking a toggle element toggles both the `toggled` class on the trigger and the `hidden` class on the target

```javascript
// registerToggleAbilityvar targets = document.querySelectorAll('.toggle');for (var i = 0; i < targets.length; i++) {    if (targets[i].dataset.target == undefined)        continue;    targets[i].addEventListener('click', function (event) {        this.classList.toggle('toggled');        var target = document.getElementById(this.dataset.target);        target.classList.toggle('hidden');        // save state in cookies        if (target.classList.contains('hidden') == false)            _this.Helper.setCookie(this.dataset.target, 1);        else            _this.Helper.setCookie(this.dataset.target, 0);    });}
```

Sources: [src/js/core/base-gui.js L186-L201](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L186-L201)

 [src/js/core/base-gui.js L272-L284](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L272-L284)

## Responsive Design

The UI adapts to different screen sizes using CSS media queries. Key responsive features include:

### Desktop View

* Full grid layout with visible left and right sidebars
* Tools directly accessible in the left sidebar
* Panels directly accessible in the right sidebar

### Mobile View (screen width < 700px)

* Left sidebar becomes a slide-out panel accessed via a toggle button
* Right sidebar also becomes a slide-out panel with its own toggle
* Mobile menu buttons appear at the bottom of the screen
* Undo button becomes visible for easier access

```

```

Sources: [index.html L93-L100](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L93-L100)

 [src/css/layout.css L177-L197](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L177-L197)

 [src/css/layout.css L582-L610](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L582-L610)

 [src/js/core/base-gui.js L203-L208](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L203-L208)

## Canvas Preparation

The canvas is dynamically prepared to match the current zoom level and viewport size:

1. Get current window dimensions
2. Calculate visible canvas size based on zoom level
3. Set canvas dimensions
4. Configure image smoothing based on zoom level
5. Render canvas background (transparent grid or solid color)
6. Update wrapper dimensions
7. Calculate canvas offset for proper mouse interaction

Sources: [src/js/core/base-gui.js L239-L270](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L239-L270)

 [src/js/core/base-gui.js L328-L342](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L328-L342)

## Theme Support

The UI supports multiple themes through CSS variables and class toggling. Themes affect colors, contrast, and the overall appearance:

1. Theme is determined from cookies or settings
2. Previous theme classes are removed from the body
3. New theme class is added to the body
4. CSS variables defined in theme classes control the UI appearance

Sources: [src/js/core/base-gui.js L474-L490](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L474-L490)

## Event Handling System

The UI sets up various event listeners for user interactions:

1. **Menu events**: Handled by the `GUI_menu` class, which dispatches actions to appropriate modules
2. **Toggle events**: For showing/hiding panels
3. **Mobile menu events**: For showing/hiding sidebars on mobile
4. **Resize events**: To adjust canvas size when the window is resized
5. **Canvas context menu**: Prevented to allow for custom handling
6. **Exit confirmation**: Optional confirmation when leaving with unsaved changes

Sources: [src/js/core/base-gui.js L164-L228](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L164-L228)

## Grid and Guides

The UI provides optional grid and guides for precise editing:

* **Grid**: Configurable horizontal and vertical lines (controlled by `grid_size`)
* **Guides**: Custom positioning guides that can be added by the user

Both features help with alignment and precise positioning during editing.

Sources: [src/js/core/base-gui.js L344-L436](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L344-L436)

## Mobile Menu

On smaller screens, the mobile menu provides access to the sidebars:

1. Left button toggles the tools sidebar
2. Right button toggles the right panels sidebar
3. Sidebars slide in from off-screen when activated

This approach maximizes available canvas space on small screens while keeping tools accessible.

Sources: [index.html L93-L100](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L93-L100)

 [src/css/layout.css L582-L610](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L582-L610)

 [src/js/core/base-gui.js L203-L208](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L203-L208)