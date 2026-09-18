# Getting Started

> **Relevant source files**
> * [README.md](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1)
> * [package.json](https://github.com/caplin/FlexLayout/blob/40753f37/package.json)

This guide provides a step-by-step introduction to FlexLayout, a flexible layout manager for React applications. You'll learn how to install FlexLayout, create a basic layout, and understand the fundamental concepts that drive the library. For comprehensive API details, see [API Reference](/caplin/FlexLayout/7-api-reference).

## Installation

FlexLayout is available through npm and can be installed with your preferred package manager:

```

```

After installation, import the core components in your application:

```

```

Then include one of the available themes by importing the CSS file:

```

```

Alternatively, add the CSS file to your HTML:

```

```

Sources: [README.md L42-L69](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L42-L69)

## Core Concepts

FlexLayout uses a model-view architecture where layout structure is defined in a `Model` instance and rendered by the `Layout` React component.

### FlexLayout Architecture - Code Entities

```

```

Sources: [src/view/Layout.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx)

 [src/model/Model.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts)

 [src/model/Actions.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Actions.ts)

 [README.md L7-L19](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L7-L19)

### Node Types

FlexLayout models the layout as a tree of node objects:

| Node Type | Class | Description |
| --- | --- | --- |
| **Row** | `RowNode` | Container that arranges children horizontally or vertically |
| **TabSet** | `TabSetNode` | Container for tabs with a header bar and selected tab |
| **Tab** | `TabNode` | Individual tab with content component reference |
| **Border** | `BorderNode` | Edge-docked container (top, bottom, left, right) |

### Example Node Hierarchy

```

```

Sources: [README.md L166-L192](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L166-L192)

 [src/model/RowNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/RowNode.ts)

 [src/model/TabSetNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabSetNode.ts)

 [src/model/TabNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts)

 [src/model/BorderNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderNode.ts)

## Minimal Working Example

Here is a minimal FlexLayout application with two tabs side by side:

```

```

### What This Code Does

1. **JSON Configuration** defines the layout structure with two `tabset` nodes, each containing one `tab`
2. **`Model.fromJson(json)`** creates a `Model` instance from the JSON configuration
3. **`factory` function** receives a `TabNode` and returns a React element based on the `component` attribute
4. **`<Layout>` component** renders the layout UI using the model and factory

Sources: [README.md L97-L153](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L97-L153)

### Code Flow Diagram

```

```

Sources: [src/model/Model.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts)

 [src/view/Layout.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx)

## JSON Model Structure

The JSON configuration passed to `Model.fromJson()` has four top-level properties:

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `global` | Object | No | Global configuration options (see [IGlobalAttributes](https://rawgit.com/caplin/FlexLayout/demos/demos/v0.8/typedoc/interfaces/IGlobalAttributes.html)) |
| `layout` | Object | Yes | Root `RowNode` defining the layout hierarchy |
| `borders` | Array | No | Array of `BorderNode` definitions for edge-docked tabs |
| `popouts` | Array | No | Array of popout window configurations |

Sources: [README.md L166-L171](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L166-L171)

### Node Types in JSON

```

```

Sources: [src/model/RowNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/RowNode.ts)

 [src/model/TabSetNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabSetNode.ts)

 [src/model/TabNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts)

 [src/model/BorderNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderNode.ts)

## Layout Component Props

The `<Layout>` component requires two props:

| Prop | Type | Description |
| --- | --- | --- |
| `model` | `Model` | Model instance created with `Model.fromJson(json)` |
| `factory` | `(node: TabNode) => React.ReactNode` | Function that returns React content for each tab |

Sources: [README.md L74-L92](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L74-L92)

 [src/view/Layout.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx)

### Factory Function Implementation

The factory function receives a `TabNode` instance and should return a React element:

```

```

The `component` attribute in the JSON tab definition determines which React component to render. The factory function acts as a routing mechanism between component names and actual React components.

Sources: [README.md L134-L153](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L134-L153)

 [src/model/TabNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts)

## Modifying the Layout Programmatically

After creating the model, modifications are made through the `Actions` API:

```

```

### Using Layout Component Methods

The `Layout` component also provides convenience methods accessed via a React ref:

```

```

Sources: [README.md L297-L334](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L297-L334)

 [README.md L376-L388](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L376-L388)

 [src/model/Actions.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Actions.ts)

 [src/view/Layout.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx)

## Theming

FlexLayout includes several built-in themes located in the `style/` directory:

| Theme File | Description |
| --- | --- |
| `light.css` | Light theme with standard colors |
| `dark.css` | Dark theme with dark background |
| `gray.css` | Gray theme variant |
| `underline.css` | Minimal theme with underlined tabs |
| `combined.css` | All themes in one file for dynamic switching |

### Static Theme Usage

Import a single theme in your application:

```

```

Or link it in HTML:

```

```

### Dynamic Theme Switching

For runtime theme switching, use `combined.css` with a className:

```

```

For details on customizing themes, see page [5.3 Customizing Themes](/caplin/FlexLayout/5.3-customizing-themes).

Sources: [README.md L56-L71](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L56-L71)

 [README.md L211-L229](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L211-L229)

 [style/](https://github.com/caplin/FlexLayout/blob/40753f37/style/)

## Customizing Appearance

The `<Layout>` component accepts callback props for customizing tab and tabset rendering:

```

```

For comprehensive customization details, see page [3.3 Tab and Button Components](/caplin/FlexLayout/3.3-tab-and-button-components).

Sources: [README.md L232-L295](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L232-L295)

 [src/view/Layout.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx)

## Next Steps

Once you've mastered the basics, you can explore more advanced features:

* Using border regions for toolbars or navigation panels
* Implementing tab drag and drop for user-defined layouts
* Setting up popout windows for multi-monitor configurations
* Creating custom themes
* Saving and loading layout configurations

For details on these advanced topics, see [Advanced Features](/caplin/FlexLayout/6-advanced-features).

Sources: [README.md L21-L40](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1#L21-L40)