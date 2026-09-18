# Advanced Features

> **Relevant source files**
> * [src/model/BorderNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderNode.ts)
> * [src/model/BorderSet.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderSet.ts)
> * [src/model/IJsonModel.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/IJsonModel.ts)
> * [src/model/Model.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts)
> * [src/model/Node.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Node.ts)
> * [src/model/RowNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/RowNode.ts)
> * [src/model/TabNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts)
> * [src/model/TabSetNode.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabSetNode.ts)
> * [src/view/Layout.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx)
> * [src/view/Tab.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Tab.tsx)

This page provides an overview of FlexLayout's advanced capabilities that extend beyond basic layout management. These features enable sophisticated interactions including drag-and-drop across windows, multi-window support with popouts, flexible docking mechanisms, and a powerful attribute configuration system.

For detailed information about specific components, see [Core Components](/caplin/FlexLayout/3-core-components). For data model architecture, see [Data Model](/caplin/FlexLayout/4-data-model).

---

## Overview of Advanced Capabilities

FlexLayout implements four major advanced feature systems:

| Feature | Primary Purpose | Key Components |
| --- | --- | --- |
| **Drag-and-Drop** | Enable intuitive tab and tabset repositioning with cross-window support | `LayoutInternal.dragState`, `DragContainer`, drag event handlers |
| **Docking System** | Determine valid drop locations and handle tab/tabset placement | `DockLocation`, `DropInfo`, `canDrop()` methods |
| **Popout Windows** | Support multi-window layouts with detachable tabs | `PopoutWindow`, `LayoutWindow`, window management in `Model` |
| **Attributes System** | Configure behavior through inherited and node-specific properties | `AttributeDefinitions`, `addInherited()`, attribute resolution |

---

## Drag-and-Drop Architecture

The drag-and-drop system uses a centralized coordination mechanism to support dragging tabs and tabsets within a window and across multiple windows.

### Global Drag State

FlexLayout maintains a single static `dragState` object shared across all `LayoutInternal` instances. This enables coordinated dragging between the main window and any popout windows.

```mermaid
flowchart TD

DragState["LayoutInternal.dragState<br>(static)"]
MainLayout["mainLayout reference"]
DragNode["dragNode: TabNode | TabSetNode"]
DragType["dragSource: Internal | External | Add"]
MW_Layout["LayoutInternal<br>isMainWindow=true"]
MW_Handlers["onDragStart<br>onDragEnter<br>onDragOver<br>onDrop"]
MW_Visual["Overlay + Outline divs"]
PW_Layout["LayoutInternal<br>windowId='uuid'"]
PW_Handlers["onDragEnter<br>onDragOver<br>onDrop"]
PW_Visual["Overlay + Outline"]
Overlay["showOverlay state<br>Grays background"]
Outline["Outline div<br>Shows drop target"]
Edges["Edge indicators<br>For edge docking"]

MW_Handlers --> DragState
MainLayout --> MW_Layout
PW_Handlers --> DragState
MW_Visual --> Overlay
MW_Visual --> Outline
MW_Visual --> Edges

subgraph subGraph3 ["Visual Feedback"]
    Overlay
    Outline
    Edges
end

subgraph subGraph2 ["Popout Window"]
    PW_Layout
    PW_Handlers
    PW_Visual
    PW_Handlers --> PW_Layout
    PW_Layout --> PW_Visual
end

subgraph subGraph1 ["Main Window"]
    MW_Layout
    MW_Handlers
    MW_Visual
    MW_Layout --> MW_Visual
end

subgraph subGraph0 ["Static Coordination"]
    DragState
    MainLayout
    DragNode
    DragType
    DragState --> MainLayout
end
```

**Sources:** [src/view/Layout.tsx L192](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L192-L192)

 [src/view/Layout.tsx L1334-L1542](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L1334-L1542)

### Drag Event Flow

```mermaid
sequenceDiagram
  participant User
  participant TabButton
  participant LayoutInternal
  participant Static DragState
  participant Model
  participant Actions

  User->>TabButton: Start drag
  TabButton->>LayoutInternal: onDragStart(event, node)
  LayoutInternal->>Static DragState: setDragNode(node, mainLayout)
  LayoutInternal->>LayoutInternal: setState({showOverlay: true})
  loop [During drag]
    User->>LayoutInternal: Mouse move
    LayoutInternal->>LayoutInternal: onDragOver(event)
    LayoutInternal->>Model: findDropTargetNode(x, y)
    Model-->>LayoutInternal: DropInfo
    LayoutInternal->>LayoutInternal: Position outline div
    User->>LayoutInternal: Release (drop)
    LayoutInternal->>LayoutInternal: onDrop(event)
    LayoutInternal->>Actions: Actions.moveNode(from, to, location)
    Actions-->>LayoutInternal: Action object
    LayoutInternal->>Model: doAction(action)
    Model->>Model: Update tree structure
  end
  LayoutInternal->>Static DragState: clearDragMain()
  LayoutInternal->>LayoutInternal: setState({showOverlay: false})
```

**Sources:** [src/view/Layout.tsx L1334-L1542](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L1334-L1542)

 [src/view/TabButton.tsx L150-L250](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L150-L250)

### Drag Enter Count Mechanism

The `dragEnterCount` mechanism handles nested drag events correctly when dragging over nested elements:

```mermaid
flowchart TD

Enter["onDragEnter<br>dragEnterCount++"]
Leave["onDragLeave<br>dragEnterCount--"]
Check["dragEnterCount<br>== 0?"]
Hide["Hide overlay"]

Enter --> Check
Leave --> Check
Check --> Hide
Check --> Enter
```

**Sources:** [src/view/Layout.tsx L211](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L211-L211)

 [src/view/Layout.tsx L1439-L1465](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L1439-L1465)

---

## Multi-Window Management

FlexLayout supports creating and managing multiple windows, allowing tabs and tabsets to be popped out into separate browser windows.

### Window Data Structures

```mermaid
flowchart TD

Windows["windows: Map"]
MainWindowID["MAIN_WINDOW_ID = 'main_window_id'"]
RootWindow["rootWindow: LayoutWindow"]
WindowID["windowId: string"]
Root["root: RowNode"]
MaxTabSet["maximizedTabSet?: TabSetNode"]
ActiveTabSet["activeTabSet?: TabSetNode"]
Window["window?: Window"]
Layout["layout?: LayoutInternal"]
ScreenRect["toScreenRectFunction"]
MainLayout["Main Window<br>isMainWindow=true<br>windowId='main_window_id'"]
PopoutLayout1["Popout Window 1<br>windowId='uuid-1'<br>mainLayout=MainLayout"]
PopoutLayout2["Popout Window 2<br>windowId='uuid-2'<br>mainLayout=MainLayout"]
LayoutWindow["LayoutWindow"]

Windows --> LayoutWindow
LayoutWindow --> WindowID
LayoutWindow --> Root
LayoutWindow --> MaxTabSet
LayoutWindow --> ActiveTabSet
LayoutWindow --> Window
LayoutWindow --> Layout
LayoutWindow --> ScreenRect
MainLayout --> RootWindow

subgraph subGraph2 ["LayoutInternal Instances"]
    MainLayout
    PopoutLayout1
    PopoutLayout2
    PopoutLayout1 --> MainLayout
    PopoutLayout2 --> MainLayout
end

subgraph subGraph1 ["LayoutWindow Class"]
    WindowID
    Root
    MaxTabSet
    ActiveTabSet
    Window
    Layout
    ScreenRect
end

subgraph Model ["Model"]
    Windows
    MainWindowID
    RootWindow
end
```

**Sources:** [src/model/Model.ts L47-L62](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L47-L62)

 [src/model/LayoutWindow.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/LayoutWindow.ts)

 [src/view/Layout.tsx L213-L216](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L213-L216)

### Popout Actions

The model handles several window-related actions:

| Action | Description | Handler Location |
| --- | --- | --- |
| `POPOUT_TABSET` | Pop out entire tabset to new window | [src/model/Model.ts L129-L150](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L129-L150) |
| `POPOUT_TAB` | Pop out single tab to new window | [src/model/Model.ts L152-L179](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L152-L179) |
| `CLOSE_WINDOW` | Close popout window and return content to main | [src/model/Model.ts L181-L195](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L181-L195) |
| `CREATE_WINDOW` | Create empty popout window | [src/model/Model.ts L197-L204](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L197-L204) |

### Window Lifecycle

```mermaid
sequenceDiagram
  participant User
  participant TabButton
  participant LayoutInternal
  participant Model
  participant PopoutWindow
  participant Browser Window

  User->>TabButton: Click popout icon
  TabButton->>LayoutInternal: doAction(Actions.popoutTab)
  LayoutInternal->>Model: doAction(action)
  Model->>Model: Create LayoutWindow with UUID
  Model->>Model: Create RowNode for window
  Model->>Model: Move tab to new window
  Model->>Model: windows.set(windowId, layoutWindow)
  LayoutInternal->>LayoutInternal: Re-render with PopoutWindow
  LayoutInternal->>PopoutWindow: Mount component
  PopoutWindow->>Browser Window: window.open(url?id=uuid)
  Browser Window->>PopoutWindow: onSetWindow callback
  PopoutWindow->>Model: Update window reference
  note over Browser Window: User closes window
  Browser Window->>PopoutWindow: beforeunload event
  PopoutWindow->>LayoutInternal: onCloseWindow callback
  LayoutInternal->>Model: doAction(Actions.closeWindow)
  Model->>Model: Move content back to main
  Model->>Model: windows.delete(windowId)
```

**Sources:** [src/view/Layout.tsx L531-L559](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L531-L559)

 [src/view/PopoutWindow.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/PopoutWindow.tsx)

 [src/model/Model.ts L152-L195](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L152-L195)

### Window Rendering Pattern

Each window has its own `LayoutInternal` instance, but only the main window listens to model changes:

```mermaid
flowchart TD

MainLayout["<br>LayoutInternal<br>isMainWindow=true"]
MainContent["Tabs in main window"]
FloatingWindows["PopoutWindow components"]
PopoutLayout1["LayoutInternal<br>windowId='uuid-1'<br>mainLayout=MainLayout"]
PopoutContent1["Tabs in popout 1"]
PopoutLayout2["LayoutInternal<br>windowId='uuid-2'<br>mainLayout=MainLayout"]
PopoutContent2["Tabs in popout 2"]
Model["Model (single instance)"]

Model --> MainLayout
FloatingWindows --> PopoutLayout1
FloatingWindows --> PopoutLayout2
PopoutLayout1 --> MainLayout
PopoutLayout2 --> MainLayout

subgraph subGraph2 ["Popout Window 2 DOM"]
    PopoutLayout2
    PopoutContent2
    PopoutLayout2 --> PopoutContent2
end

subgraph subGraph1 ["Popout Window 1 DOM"]
    PopoutLayout1
    PopoutContent1
    PopoutLayout1 --> PopoutContent1
end

subgraph subGraph0 ["Main Window DOM"]
    MainLayout
    MainContent
    FloatingWindows
    MainLayout --> FloatingWindows
    MainLayout --> MainContent
end
```

**Sources:** [src/view/Layout.tsx L531-L559](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L531-L559)

 [src/view/Layout.tsx L275-L298](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L275-L298)

---

## Docking and Drop Validation

The docking system determines where and how tabs and tabsets can be dropped within the layout.

### DockLocation Enumeration

`DockLocation` defines the possible drop positions:

```mermaid
flowchart TD

DockLocation["DockLocation enum"]
TOP["TOP<br>orientation: HORZ<br>indexPlus: 0"]
BOTTOM["BOTTOM<br>orientation: HORZ<br>indexPlus: 1"]
LEFT["LEFT<br>orientation: VERT<br>indexPlus: 0"]
RIGHT["RIGHT<br>orientation: VERT<br>indexPlus: 1"]
CENTER["CENTER<br>orientation: HORZ<br>indexPlus: 0"]
Methods["Methods:<br>getName()<br>getOrientation()<br>getDockRect(rect)<br>getLocation(rect, x, y)"]

DockLocation --> TOP
DockLocation --> BOTTOM
DockLocation --> LEFT
DockLocation --> RIGHT
DockLocation --> CENTER
DockLocation --> Methods
```

**Sources:** [src/DockLocation.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/DockLocation.ts)

### DropInfo Structure

`DropInfo` encapsulates information about a potential drop target:

| Property | Type | Description |
| --- | --- | --- |
| `node` | `Node & IDropTarget` | Target node where drop would occur |
| `rect` | `Rect` | Visual rectangle for drop outline |
| `location` | `DockLocation` | Where relative to target (CENTER, TOP, etc.) |
| `index` | `number` | Index position within tabset (-1 for append) |
| `className` | `string` | CSS class for visual feedback |

**Sources:** [src/DropInfo.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/DropInfo.ts)

### Drop Validation Flow

```mermaid
sequenceDiagram
  participant Dragging Node
  participant LayoutInternal
  participant Model
  participant Target Node
  participant onAllowDrop

  LayoutInternal->>LayoutInternal: onDragOver(x, y)
  LayoutInternal->>Model: findDropTargetNode(windowId, dragNode, x, y)
  Model->>Model: Visit node tree
  loop [For each node containing (x,y)]
    Model->>Target Node: canDrop(dragNode, x, y)
    Target Node->>Target Node: Check geometry
    Target Node->>Target Node: Calculate DockLocation
    Target Node-->>Model: Return DropInfo or undefined
    Model-->>LayoutInternal: DropInfo
    LayoutInternal->>Dragging Node: canDockInto(dragNode, dropInfo)
    Dragging Node->>Target Node: isEnableDrop()?
    Target Node-->>Dragging Node: boolean
    Dragging Node->>Target Node: isEnableDivide()?
    Target Node-->>Dragging Node: boolean
    note over Dragging Node: Prevent named tabset
    Dragging Node->>Model: getOnAllowDrop()
    Model->>onAllowDrop: onAllowDrop(dragNode, dropInfo)
    onAllowDrop-->>Dragging Node: boolean
    Dragging Node-->>LayoutInternal: Final allowed/denied
    LayoutInternal->>LayoutInternal: Show outline at dropInfo.rect
    LayoutInternal->>LayoutInternal: Hide outline
  end
```

**Sources:** [src/view/Layout.tsx L1482-L1523](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L1482-L1523)

 [src/model/Model.ts L568-L574](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L568-L574)

 [src/model/Node.ts L204-L225](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Node.ts#L204-L225)

### Node-Specific Drop Handling

Different node types implement `canDrop()` differently:

```mermaid
flowchart TD

IDropTarget["IDropTarget interface<br>canDrop(dragNode, x, y): DropInfo?"]
TabSetNode["TabSetNode.canDrop()<br>- Tab strip drops<br>- Content area drops<br>- Split into regions"]
BorderNode["BorderNode.canDrop()<br>- Header area drops<br>- Content area drops<br>- Orientation-aware"]
RowNode["RowNode.canDrop()<br>- Edge dock detection<br>- Only for root node<br>- enableEdgeDock check"]

IDropTarget --> TabSetNode
IDropTarget --> BorderNode
IDropTarget --> RowNode
```

**Sources:** [src/model/TabSetNode.ts L305-L370](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabSetNode.ts#L305-L370)

 [src/model/BorderNode.ts L233-L312](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderNode.ts#L233-L312)

 [src/model/RowNode.ts L371-L417](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/RowNode.ts#L371-L417)

---

## Attribute Configuration System

FlexLayout uses a sophisticated attribute system that supports inheritance from global defaults, allowing fine-grained control over behavior at multiple levels.

### Attribute Hierarchy

```mermaid
flowchart TD

Global["Global Attributes<br>(Model level)<br>e.g. tabEnableClose=true"]
TabSet["TabSet Node<br>Inherits from Global<br>Can override"]
Border["Border Node<br>Inherits from Global<br>Can override"]
Tab["Tab Node<br>Inherits from Global<br>Can override"]
Row["Row Node<br>Local attributes only"]
Resolution["Attribute Resolution:<br>1. Check node.attributes[name]<br>2. Get modelName from definitions<br>3. Check model.attributes[modelName]<br>4. Return default from definition"]

Global --> TabSet
Global --> Border
Global --> Tab
Tab --> Resolution
TabSet --> Resolution
Border --> Resolution
```

**Sources:** [src/model/Model.ts L626-L702](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L626-L702)

 [src/model/Node.ts L105-L117](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Node.ts#L105-L117)

### AttributeDefinitions Class

The `AttributeDefinitions` class manages attribute metadata:

```python
// Example usage pattern from TabSetNodeattributeDefinitions.add("selected", 0)    .setType(Attribute.NUMBER)    .setDescription("index of selected/visible tab in tabset"); attributeDefinitions.addInherited("enableDrop", "tabSetEnableDrop")    .setDescription("allow user to drag tabs into this tabset");
```

| Method | Purpose |
| --- | --- |
| `add(name, defaultValue)` | Define local attribute with default |
| `addInherited(localName, globalName)` | Define attribute that inherits from global |
| `fromJson(json, attributes)` | Populate attributes from JSON |
| `toJson(json, attributes)` | Serialize attributes to JSON |
| `update(json, attributes)` | Update existing attributes |
| `getModelName(name)` | Get global name for inherited attribute |

**Sources:** [src/AttributeDefinitions.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/AttributeDefinitions.ts)

 [src/model/TabSetNode.ts L512-L588](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabSetNode.ts#L512-L588)

### Attribute Resolution Example

```mermaid
sequenceDiagram
  participant Application Code
  participant TabNode
  participant AttributeDefinitions
  participant Model

  Application Code->>TabNode: isEnableClose()
  TabNode->>TabNode: getAttr("enableClose")
  TabNode->>TabNode: Check attributes["enableClose"]
  loop [Set in global]
    TabNode-->>Application Code: Return node value
    TabNode->>AttributeDefinitions: getModelName("enableClose")
    AttributeDefinitions-->>TabNode: "tabEnableClose"
    TabNode->>Model: getAttribute("tabEnableClose")
    Model-->>TabNode: Return global value
    TabNode-->>Application Code: Return global value
    note over TabNode: Return default from
    TabNode-->>Application Code: Return default (true)
  end
```

**Sources:** [src/model/Node.ts L105-L117](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Node.ts#L105-L117)

 [src/model/TabNode.ts L339-L423](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts#L339-L423)

### Runtime Attribute Updates

Attributes can be updated at runtime using actions:

```sql
// Update model-level (global) attributesmodel.doAction(Actions.updateModelAttributes({    tabEnableClose: false,    tabSetEnableMaximize: false})); // Update node-specific attributesmodel.doAction(Actions.updateNodeAttributes(nodeId, {    enableClose: true,  // Override global for this node    config: { customData: "value" }}));
```

**Sources:** [src/model/Model.ts L280-L289](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L280-L289)

 [src/model/Actions.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Actions.ts)

### Inherited Attribute Examples

Common inherited attributes by node type:

**TabNode inherited attributes:**

* `enableClose` ← `tabEnableClose`
* `enableDrag` ← `tabEnableDrag`
* `enablePopout` ← `tabEnablePopout`
* `className` ← `tabClassName`
* `icon` ← `tabIcon`

**TabSetNode inherited attributes:**

* `enableDrop` ← `tabSetEnableDrop`
* `enableMaximize` ← `tabSetEnableMaximize`
* `autoSelectTab` ← `tabSetAutoSelectTab`
* `enableTabStrip` ← `tabSetEnableTabStrip`

**BorderNode inherited attributes:**

* `enableDrop` ← `borderEnableDrop`
* `size` ← `borderSize`
* `autoSelectTabWhenOpen` ← `borderAutoSelectTabWhenOpen`

**Sources:** [src/model/TabNode.ts L368-L420](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts#L368-L420)

 [src/model/TabSetNode.ts L529-L586](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabSetNode.ts#L529-L586)

 [src/model/BorderNode.ts L417-L443](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/BorderNode.ts#L417-L443)

---

## Integration of Advanced Features

These advanced features work together to provide a cohesive experience:

```mermaid
flowchart TD

User["User Interaction"]
DragStart["Start Drag"]
DragState["Update DragState"]
FindTarget["Find Drop Target"]
ValidateLocation["Calculate DockLocation"]
CheckDrop["canDrop validation"]
CheckAttrs["Check enable attributes"]
GetEnableDrag["getAttribute('enableDrag')"]
GetEnableDrop["getAttribute('enableDrop')"]
GetEnableDivide["getAttribute('enableDivide')"]
CheckWindow["Check window compatibility"]
CrossWindow["Allow cross-window?"]
UpdateWindow["Update window state"]
CreateAction["Create MOVE_NODE action"]
ApplyAction["model.doAction()"]
UpdateTree["Update node tree"]

User --> DragStart
FindTarget --> ValidateLocation
CheckDrop --> GetEnableDrag
CheckDrop --> GetEnableDrop
CheckDrop --> GetEnableDivide
CheckDrop --> CheckWindow
GetEnableDrag --> CheckAttrs
GetEnableDrop --> CheckAttrs
GetEnableDivide --> CheckAttrs
CheckAttrs --> CreateAction
CrossWindow --> CreateAction
UpdateTree --> UpdateWindow

subgraph subGraph4 ["Model Actions"]
    CreateAction
    ApplyAction
    UpdateTree
    CreateAction --> ApplyAction
    ApplyAction --> UpdateTree
end

subgraph subGraph3 ["Window System"]
    CheckWindow
    CrossWindow
    UpdateWindow
    CheckWindow --> CrossWindow
end

subgraph subGraph2 ["Attribute System"]
    GetEnableDrag
    GetEnableDrop
    GetEnableDivide
end

subgraph subGraph1 ["Docking System"]
    ValidateLocation
    CheckDrop
    CheckAttrs
    ValidateLocation --> CheckDrop
end

subgraph subGraph0 ["Drag-Drop System"]
    DragStart
    DragState
    FindTarget
    DragStart --> DragState
    DragState --> FindTarget
end
```

**Sources:** [src/view/Layout.tsx L1482-L1542](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L1482-L1542)

 [src/model/Model.ts L71-L301](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L71-L301)

 [src/model/Node.ts L204-L225](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Node.ts#L204-L225)

---

## Summary

FlexLayout's advanced features enable sophisticated layout manipulation:

1. **Drag-and-Drop**: Global state coordination allows seamless dragging across windows with visual feedback
2. **Multi-Window**: Independent window instances with shared model enable complex multi-monitor setups
3. **Docking**: Flexible validation system with geometry-based and policy-based checks
4. **Attributes**: Hierarchical configuration with global defaults and node-level overrides

For implementation details of each feature, see the dedicated child pages: [Drag and Drop](/caplin/FlexLayout/6.1-drag-and-drop), [Docking System](/caplin/FlexLayout/6.2-docking-system), [Popout Windows](/caplin/FlexLayout/6.3-popout-windows), and [Attributes System](/caplin/FlexLayout/6.4-attributes-system).