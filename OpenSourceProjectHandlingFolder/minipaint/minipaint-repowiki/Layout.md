# Layout

> **Relevant source files**
> * [index.html](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html)
> * [manifest-disabled.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/manifest-disabled.json)
> * [src/css/layout.css](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css)
> * [src/js/core/base-gui.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js)

## Purpose and Scope

This document describes the overall UI layout system of miniPaint, explaining how the application interface is structured, organized, and rendered. It covers the grid-based layout, responsive design implementation, and how various UI components are positioned and interact with each other. For information about specific UI components like menus or tools panels, see [Menu System](/viliusle/miniPaint/3.2-menu-system) and [Tools Panel](/viliusle/miniPaint/3.3-tools-panel).

## Overall Layout Structure

miniPaint uses a CSS grid-based layout system to organize its interface into distinct functional areas. The application UI is divided into several main regions: a top menu bar, a submenu area, left sidebar (tools), main canvas area, and right sidebar (layers, colors, etc.).

### Main Layout Grid

```mermaid
flowchart TD

wrapper["wrapper (Main Container)"]
submenu["submenu (Top Controls)"]
sidebar_left["sidebar_left (Tools)"]
middle_area["middle_area (Canvas)"]
sidebar_right["sidebar_right (Panels)"]

subgraph subGraph0 ["Layout Grid Structure"]
    wrapper
    submenu
    sidebar_left
    middle_area
    sidebar_right
    wrapper --> submenu
    wrapper --> sidebar_left
    wrapper --> middle_area
    wrapper --> sidebar_right
end
```

Sources: [index.html L33-L92](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L33-L92)

 [src/css/layout.css L1-L20](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L1-L20)

The layout is defined as a CSS grid with the following template areas:

* `submenu`: Spans across the top, containing logo and tool attributes
* `sidebar_left`: Left side, containing tool buttons
* `main`: Middle area, containing the canvas
* `sidebar_right`: Right side, containing layers, colors, and information panels

### HTML Structure

The basic HTML structure that implements this layout is:

```mermaid
flowchart TD

body["body"]
wrapper["div.wrapper"]
menu["nav.main_menu"]
submenu["div.submenu"]
tools["div.sidebar_left"]
middle["div.middle_area"]
right["div.sidebar_right"]
mobile["div.mobile_menu"]
popups["div#popups"]
canvas_wrapper["div.canvas_wrapper"]
canvas["canvas#canvas_minipaint"]
preview["div.preview"]
colors["div.colors"]
info["div.block#info_base"]
details["div.details"]
layers["div.layers"]

subgraph subGraph0 ["HTML Component Structure"]
    body
    wrapper
    menu
    submenu
    tools
    middle
    right
    mobile
    popups
    canvas_wrapper
    canvas
    preview
    colors
    info
    details
    layers
    body --> wrapper
    wrapper --> menu
    wrapper --> submenu
    wrapper --> tools
    wrapper --> middle
    wrapper --> right
    body --> mobile
    body --> popups
    middle --> canvas_wrapper
    canvas_wrapper --> canvas
    right --> preview
    right --> colors
    right --> info
    right --> details
    right --> layers
end
```

Sources: [index.html L32-L103](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L32-L103)

## Component Details

### Left Sidebar (Tools)

The left sidebar contains tool buttons arranged in a vertical panel. Each tool is represented by an icon button with a specific class that determines its appearance.

Key characteristics:

* Fixed width (40px by default)
* Scrollable when tools exceed the available height
* Each tool is 30x25px with specific icon styling

```mermaid
flowchart TD

tools["sidebar_left"]
select["item.select"]
brush["item.brush"]
pencil["item.pencil"]
shapes["item.shape"]
text["item.text"]
other["...other tools"]

subgraph subGraph0 ["Left Sidebar Structure"]
    tools
    select
    brush
    pencil
    shapes
    text
    other
    tools --> select
    tools --> brush
    tools --> pencil
    tools --> shapes
    tools --> text
    tools --> other
end
```

Sources: [src/css/layout.css L252-L329](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L252-L329)

 [index.html L45](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L45-L45)

### Right Sidebar (Panels)

The right sidebar contains multiple expandable panels for various functions:

* Preview panel: Shows a thumbnail of the entire canvas
* Colors panel: For color selection
* Information panel: Displays image statistics
* Layer details panel: Shows details of the selected layer
* Layers panel: For managing layers

Each panel can be expanded or collapsed using a toggle header.

```mermaid
flowchart TD

sidebar["sidebar_right"]
preview["div.preview.block"]
colors["div.colors.block"]
info["div.block#info_base"]
details["div.details.block"]
layers["div.layers.block"]
preview_toggle["h2.toggle"]
preview_content["div#toggle_preview"]
layers_title["h2.trn"]
layers_content["div#layers_base"]

subgraph subGraph0 ["Right Sidebar Structure"]
    sidebar
    preview
    colors
    info
    details
    layers
    preview_toggle
    preview_content
    layers_title
    layers_content
    sidebar --> preview
    sidebar --> colors
    sidebar --> info
    sidebar --> details
    sidebar --> layers
    preview --> preview_toggle
    preview --> preview_content
    layers --> layers_title
    layers --> layers_content
end
```

Sources: [index.html L66-L91](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L66-L91)

 [src/css/layout.css L333-L348](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L333-L348)

### Canvas Area

The central canvas area contains:

* Rulers (optional)
* Main canvas wrapper
* Transparent grid background
* The actual canvas element

```mermaid
flowchart TD

middle["middle_area"]
ruler_left["canvas.ruler_left"]
ruler_top["canvas.ruler_top"]
wrapper["div.main_wrapper"]
canvas_wrapper["div.canvas_wrapper"]
mouse["div#mouse"]
background["div.transparent-grid"]
canvas["canvas#canvas_minipaint"]

subgraph subGraph0 ["Canvas Area Structure"]
    middle
    ruler_left
    ruler_top
    wrapper
    canvas_wrapper
    mouse
    background
    canvas
    middle --> ruler_left
    middle --> ruler_top
    middle --> wrapper
    wrapper --> canvas_wrapper
    canvas_wrapper --> mouse
    canvas_wrapper --> background
    canvas_wrapper --> canvas
end
```

Sources: [index.html L48-L64](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L48-L64)

 [src/css/layout.css L613-L735](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L613-L735)

## Responsive Design Implementation

miniPaint implements responsive design to adapt to different screen sizes, particularly focusing on mobile devices.

### Desktop vs Mobile Layout

```mermaid
flowchart TD

layout["Layout"]
desktop["Desktop Layout"]
mobile["Mobile Layout"]
visible_sidebars["Always Visible Sidebars"]
hidden_sidebars["Hidden Sidebars with Toggle"]
mobile_buttons["Mobile Menu Buttons"]
undo_visible["Visible Undo Button"]

subgraph subGraph0 ["Responsive Layout Flow"]
    layout
    desktop
    mobile
    visible_sidebars
    hidden_sidebars
    mobile_buttons
    undo_visible
    layout --> desktop
    layout --> mobile
    desktop --> visible_sidebars
    mobile --> hidden_sidebars
    mobile --> mobile_buttons
    mobile --> undo_visible
end
```

Sources: [src/css/layout.css L193-L197](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L193-L197)

 [src/css/layout.css L582-L610](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L582-L610)

Key responsive features include:

1. Sidebars become hidden off-screen on mobile devices (width ≤ 700px)
2. Toggle buttons appear to show/hide sidebars
3. Canvas area adjusts to available space
4. Undo button becomes visible on smaller screens

### Media Queries

The layout uses several media queries to adapt to different screen sizes:

1. Mobile devices (max-width: 700px): * Moves sidebars off-screen * Adds slide-out behavior * Shows mobile menu buttons
2. Smaller height screens (max-height: 690px): * Adjusts left sidebar width to 75px
3. Very small screens (max-height: 450px): * Further adjusts left sidebar width to 88px

Sources: [src/css/layout.css L582-L610](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L582-L610)

 [src/css/layout.css L731-L745](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L731-L745)

## Canvas Sizing and Positioning

The canvas element is dynamically sized based on:

1. The actual document dimensions (WIDTH and HEIGHT in config)
2. The current zoom level
3. The available viewport size

```mermaid
flowchart TD

start["Initialize Canvas"]
get_wrapper["Get Main Wrapper Dimensions"]
calc_size["Calculate Canvas Size Based on:<br>- Document size<br>- Zoom level<br>- Available space"]
set_size["Set Canvas width/height"]
update_wrapper["Update Canvas Wrapper Size"]

subgraph subGraph0 ["Canvas Sizing Logic"]
    start
    get_wrapper
    calc_size
    set_size
    update_wrapper
    start --> get_wrapper
    get_wrapper --> calc_size
    calc_size --> set_size
    set_size --> update_wrapper
end
```

Sources: [src/js/core/base-gui.js L239-L270](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L239-L270)

The `prepare_canvas()` method in Base_gui_class handles this sizing logic, ensuring that:

1. The canvas doesn't exceed the available viewport
2. The proper scaling is applied based on zoom
3. The wrapper dimensions match the canvas size

## Panel Toggling System

miniPaint implements a panel toggling system that allows users to show/hide panels in the interface.

```mermaid
flowchart TD

toggle["Toggle Button Click"]
toggle_class["Toggle 'toggled' Class on Button"]
toggle_panel["Toggle 'hidden' Class on Target Panel"]
save_state["Save State to Cookie"]
load["Page Load"]
read_cookie["Read State from Cookie"]
apply_state["Apply Saved State"]

subgraph subGraph0 ["Panel Toggle System"]
    toggle
    toggle_class
    toggle_panel
    save_state
    load
    read_cookie
    apply_state
    toggle --> toggle_class
    toggle_class --> toggle_panel
    toggle_panel --> save_state
    load --> read_cookie
    read_cookie --> apply_state
end
```

Sources: [src/js/core/base-gui.js L187-L201](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L187-L201)

 [src/js/core/base-gui.js L272-L284](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L272-L284)

Key features:

* Toggle buttons are identified by class `.toggle`
* Target panel ID is specified in `data-target` attribute
* Panel state (expanded/collapsed) is saved in cookies
* States are restored when the application loads

## Mobile Menu System

On mobile devices, the sidebars are hidden by default and can be toggled with dedicated buttons.

```mermaid
flowchart TD

left_button["Left Mobile Menu Button"]
toggle_left["Toggle .active Class on .sidebar_left"]
right_button["Right Mobile Menu Button"]
toggle_right["Toggle .active Class on .sidebar_right"]
show_hide_left["Show/Hide Left Sidebar"]
show_hide_right["Show/Hide Right Sidebar"]

subgraph subGraph0 ["Mobile Menu System"]
    left_button
    toggle_left
    right_button
    toggle_right
    show_hide_left
    show_hide_right
    left_button --> toggle_left
    right_button --> toggle_right
    toggle_left --> show_hide_left
    toggle_right --> show_hide_right
end
```

Sources: [src/js/core/base-gui.js L203-L208](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L203-L208)

 [index.html L93-L100](https://github.com/viliusle/miniPaint/blob/6d0b95e5/index.html#L93-L100)

 [src/css/layout.css L582-L610](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css#L582-L610)

## Layout Initialization Process

When the application starts, the layout is initialized through the following process:

```mermaid
sequenceDiagram
  participant Application
  participant Base_gui_class
  participant DOM Elements

  Application->>Base_gui_class: init()
  Base_gui_class->>Base_gui_class: load_modules()
  Base_gui_class->>Base_gui_class: load_default_values()
  Base_gui_class->>Base_gui_class: render_main_gui()
  Base_gui_class->>Base_gui_class: autodetect_dimensions()
  Base_gui_class->>Base_gui_class: change_theme()
  Base_gui_class->>Base_gui_class: prepare_canvas()
  Base_gui_class->>DOM Elements: render_main_tools()
  Base_gui_class->>DOM Elements: render_main_preview()
  Base_gui_class->>DOM Elements: render_main_colors()
  Base_gui_class->>DOM Elements: render_main_layers()
  Base_gui_class->>DOM Elements: render_main_information()
  Base_gui_class->>DOM Elements: render_main_details()
  Base_gui_class->>DOM Elements: render_main_menu()
  Base_gui_class->>Base_gui_class: load_saved_changes()
  Base_gui_class->>Base_gui_class: set_events()
  Base_gui_class->>Base_gui_class: load_translations()
  Application->>DOM Elements: Window resize event
  DOM Elements->>Base_gui_class: prepare_canvas()
```

Sources: [src/js/core/base-gui.js L72-L152](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L72-L152)

 [src/js/core/base-gui.js L209-L214](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L209-L214)

## Theme Support

The layout supports multiple themes with a class-based theming system. The theme affects colors and styles throughout the interface.

```mermaid
flowchart TD

theme_change["change_theme() Method"]
get_cookie["Get Theme from Cookie"]
choose_cookie["Use Cookie Value"]
get_setting["Get Default from Settings"]
remove_old["Remove Old Theme Classes"]
add_new["Add New Theme Class to Body"]

subgraph subGraph0 ["Theme System"]
    theme_change
    get_cookie
    choose_cookie
    get_setting
    remove_old
    add_new
    theme_change --> get_cookie
    get_cookie --> choose_cookie
    get_cookie --> get_setting
    choose_cookie --> remove_old
    get_setting --> remove_old
    remove_old --> add_new
end
```

Sources: [src/js/core/base-gui.js L474-L490](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L474-L490)

Themes are applied by adding a class to the `body` element, which then cascades to affect all themed elements through CSS variables.

## Conclusion

miniPaint's layout system is designed to be responsive, flexible, and user-friendly across different device sizes. The grid-based structure provides a clear separation of components while maintaining a cohesive interface. The toggle system allows users to customize their workspace by showing only the panels they need.

The responsive design ensures that the application remains usable on mobile devices through an adaptive layout that changes based on the available screen space. The central canvas area dynamically adjusts to make the most of the available space while maintaining the proper aspect ratio and scaling based on zoom level.

By understanding this layout system, developers can effectively modify, extend, or debug the miniPaint interface while maintaining its responsive and user-friendly design.