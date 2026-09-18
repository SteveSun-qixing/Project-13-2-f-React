# Data Model

> **Relevant source files**
> * [README.md](https://github.com/caplin/FlexLayout/blob/40753f37/README.md?plain=1)
> * [src/model/BorderNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderNode.ts)
> * [src/model/BorderSet.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderSet.ts)
> * [src/model/IJsonModel.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/IJsonModel.ts)
> * [src/model/Model.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts)
> * [src/model/Node.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Node.ts)
> * [src/model/RowNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/RowNode.ts)
> * [src/model/TabNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts)
> * [src/model/TabSetNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabSetNode.ts)
> * [src/view/Tab.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Tab.tsx)

This page documents the core data model of the FlexLayout library, which forms the backbone of the layout management system. The data model represents the hierarchical structure of tabs, tab sets, rows, and borders that make up the layout.

For information about how actions modify this model, see [Actions and State Management](/caplin/FlexLayout/4.3-actions-and-state-management). For details on how individual nodes are implemented, see [Node Hierarchy](/caplin/FlexLayout/4.2-node-hierarchy).

## Overview

The FlexLayout data model consists of a tree structure of nodes that represent different parts of the layout. At the center of this structure is the `Model` class that maintains the entire layout state. The model can be created from a JSON structure, modified through actions, and serialized back to JSON for persistence.

```

```

Sources: [src/model/Model.ts L28-L703](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L28-L703)

 [src/model/Node.ts L10-L276](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Node.ts#L10-L276)

 [src/model/TabNode.ts L11-L424](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts#L11-L424)

 [src/model/TabSetNode.ts L20-L592](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabSetNode.ts#L20-L592)

 [src/model/RowNode.ts L18-L559](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/RowNode.ts#L18-L559)

 [src/model/BorderNode.ts L17-L446](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderNode.ts#L17-L446)

 [src/model/BorderSet.ts L8-L87](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderSet.ts#L8-L87)

## Model Structure

The `Model` class is the root container for the entire layout structure. It maintains:

1. **Node Tree**: A hierarchical structure of nodes (tabs, tabsets, rows)
2. **Border Set**: A collection of border nodes for the top, right, bottom, and left edges
3. **ID Map**: A map of node IDs to node instances for quick lookups
4. **Windows Map**: A map of window IDs to layout windows (for main window and pop-outs)
5. **Attributes**: Global configuration that can be inherited by nodes

```

```

Sources: [src/model/Model.ts L28-L66](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L28-L66)

 [src/model/Model.ts L328-L330](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L328-L330)

 [src/model/BorderSet.ts L8-L87](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderSet.ts#L8-L87)

## Model Initialization and Serialization

### Creating a Model from JSON

The `Model.fromJson` static method creates a new model from a JSON structure:

```

```

Sources: [src/model/Model.ts L400-L418](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L400-L418)

### Serializing to JSON

The `Model.toJson` method serializes the model back to a JSON structure:

```

```

Sources: [src/model/Model.ts L424-L446](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L424-L446)

## JSON Model Structure

The FlexLayout model is represented as a JSON structure with the following top-level elements:

| Field | Type | Description |
| --- | --- | --- |
| `global` | Object | Global attributes that can be inherited by nodes |
| `borders` | Array | Border nodes for top, right, bottom, and left edges |
| `layout` | Object | Root row node containing the main layout structure |
| `popouts` | Object | Popped-out windows with their layouts |

Here's an example of a simple JSON model structure:

```

```

Sources: [src/model/IJsonModel.ts L5-L17](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/IJsonModel.ts#L5-L17)

 [src/model/Model.ts L424-L446](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L424-L446)

## Node Types and Relationships

The FlexLayout model consists of four main node types, each with specific responsibilities:

### 1. TabNode

TabNodes represent individual content containers (tabs). They are always leaf nodes in the tree structure.

**Key Properties:**

* `name`: The display name of the tab
* `component`: The component to render inside the tab
* `enableClose`, `enableDrag`, etc.: Control behavioral aspects

Sources: [src/model/TabNode.ts L11-L424](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts#L11-L424)

### 2. TabSetNode

TabSetNodes are containers for TabNodes. They display a tab bar and the content of the selected tab.

**Key Properties:**

* `selected`: Index of the selected tab
* `enableClose`, `enableMaximize`, etc.: Control behavioral aspects
* `weight`: Relative size within parent row

Sources: [src/model/TabSetNode.ts L20-L592](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabSetNode.ts#L20-L592)

### 3. RowNode

RowNodes arrange TabSetNodes and other RowNodes horizontally or vertically (based on its level in the tree).

**Key Properties:**

* `weight`: Relative size within parent
* `orientation`: Horizontal or vertical (calculated based on parent)
* `children`: Contains TabSetNodes or other RowNodes

Sources: [src/model/RowNode.ts L18-L559](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/RowNode.ts#L18-L559)

### 4. BorderNode

BorderNodes represent the four border regions of the layout (top, right, bottom, left) that can contain docked tabs.

**Key Properties:**

* `location`: The border location (top, right, bottom, left)
* `size`: The size of the border when expanded
* `selected`: Index of the selected tab

Sources: [src/model/BorderNode.ts L17-L446](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderNode.ts#L17-L446)

## Node ID Management

Each node in the model has a unique ID that is either specified in the JSON or automatically generated. The model maintains an ID map for quick lookups:

```

```

The ID map is updated whenever nodes are added, removed, or modified:

1. When a new node is created: `model.addNode(node)`
2. After every action: `model.updateIdMap()`

Sources: [src/model/Model.ts L545-L555](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L545-L555)

 [src/model/Model.ts L557-L565](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L557-L565)

## Attribute System

FlexLayout uses a sophisticated attribute system to manage configuration:

1. **Global Attributes**: Defined at the model level
2. **Node Attributes**: Defined at the node level
3. **Inherited Attributes**: Global attributes that are inherited by nodes

```

```

This inheritance mechanism allows for defining default behavior globally while allowing overrides at the node level.

Sources: [src/model/IJsonModel.ts L49-L967](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/IJsonModel.ts#L49-L967)

 [src/model/Node.ts L105-L117](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Node.ts#L105-L117)

## Model Traversal and Node Access

The model provides several methods to access and traverse the node tree:

1. **Visiting Nodes**: ``` ```
2. **Finding Nodes by ID**: ``` ```
3. **Getting Special Nodes**: ``` ```

Sources: [src/model/Model.ts L356-L370](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L356-L370)

 [src/model/Model.ts L376-L378](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L376-L378)

 [src/model/Model.ts L308-L322](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L308-L322)

## Conclusion

The FlexLayout data model provides a robust foundation for managing complex layout structures. Its hierarchical node tree, combined with the attribute system and action-based modifications, allows for a flexible and powerful layout management system.

For information on how actions modify this model, refer to [Actions and State Management](/caplin/FlexLayout/4.3-actions-and-state-management), which details how all state changes flow through the action system to maintain a predictable state management approach.

Sources: [src/model/Model.ts L28-L703](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L28-L703)

 [src/model/Node.ts L10-L276](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Node.ts#L10-L276)