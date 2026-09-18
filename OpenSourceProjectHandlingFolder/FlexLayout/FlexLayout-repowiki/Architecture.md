# Architecture

> **Relevant source files**
> * [package.json](https://github.com/caplin/FlexLayout/blob/40753f37/package.json)
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

This document outlines the architectural design and structure of FlexLayout, a flexible layout manager for React applications. It explains the core architectural patterns, component structure, and data flow that enable FlexLayout's functionality. For information about using specific components, see [Core Components](/caplin/FlexLayout/3-core-components) and for details about the data model implementation, see [Data Model](/caplin/FlexLayout/4-data-model).

## Architectural Overview

FlexLayout follows a model-view architecture pattern with a clear separation between the layout model (data structure) and its visual representation (React components). All changes to the layout happen through a well-defined action system, enabling predictable state management.

```mermaid
flowchart TD

UI["User Interface Layer"]
View["View Layer (React Components)"]
Actions["Actions Layer"]
ModelLayer["Model Layer (Data Structure)"]

subgraph subGraph0 ["Architecture Layers"]
    UI
    View
    Actions
    ModelLayer
    UI --> View
    View --> Actions
    Actions --> ModelLayer
    ModelLayer --> View
end
```

Sources: [src/view/Layout.tsx L1-L166](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L1-L166)

 [src/model/Model.ts L1-L100](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L1-L100)

## Key Components

The FlexLayout architecture consists of four main layers:

1. **User Interface Layer**: The visible UI elements users interact with
2. **View Layer**: React components that render the model
3. **Model Layer**: Data structures that represent the layout
4. **Actions Layer**: Action creators and processors for changing model state

```mermaid
classDiagram
    class Layout {
        +model: Model
        +factory() : : ReactNode
        +redraw()
        +addTabToTabSet()
        +moveTabWithDragAndDrop()
    }
    class Model {
        +doAction(action: Action)
        +getRoot() : : RowNode
        +getBorderSet() : : BorderSet
        +visitNodes(fn)
        +fromJson(json) : : Model
        +toJson() : : IJsonModel
    }
    class Node {
        +id: string
        +getType() : : string
        +getChildren() : : Node[]
        +getParent() : : Node
    }
    class Actions {
        +addNode()
        +moveNode()
        +deleteTab()
        +maximizeToggle()
        +updateNodeAttributes()
    }
    class TabNode {
    }
    class TabSetNode {
    }
    class RowNode {
    }
    class BorderNode {
    }
    Layout --> Model : uses
    Model --> Node : contains
    Model --> Actions : processes
    Node <|-- TabNode
    Node <|-- TabSetNode
    Node <|-- RowNode
    Node <|-- BorderNode
```

Sources: [src/view/Layout.tsx L32-L162](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L32-L162)

 [src/model/Model.ts L28-L704](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L28-L704)

 [src/model/TabNode.ts L11-L424](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts#L11-L424)

## Design Patterns

FlexLayout uses several key design patterns to maintain a clean architecture:

1. **Model-View Pattern**: Separates data (model) from presentation (view)
2. **Component-Based Design**: Builds UIs from reusable components
3. **Action-Based State Management**: All changes go through actions
4. **Tree Structure**: Represents layouts as a hierarchical tree
5. **Factory Pattern**: Uses factory functions to create tab content

### Model-View Pattern

```mermaid
sequenceDiagram
  participant User
  participant View Components
  participant Actions
  participant Model

  User->>View Components: Interacts (drag, click)
  View Components->>Actions: Create action
  Actions->>Model: doAction(action)
  Model->>Model: Update model structure
  Model->>View Components: Notify changes
  View Components->>User: Update display
```

Sources: [src/view/Layout.tsx L85-L159](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L85-L159)

 [src/model/Model.ts L70-L301](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L70-L301)

## Component Structure

The component hierarchy follows a well-defined structure that maps to the model's node hierarchy.

```mermaid
flowchart TD

Layout["Layout"]
LayoutInternal["LayoutInternal"]
Row["Row"]
BorderTabSet["BorderTabSet"]
TabSet["TabSet"]
Splitter["Splitter"]
Tab["Tab"]
TabButton["TabButton"]
BorderButton["BorderButton"]
BorderTab["BorderTab"]

subgraph subGraph0 ["Component Hierarchy"]
    Layout
    LayoutInternal
    Row
    BorderTabSet
    TabSet
    Splitter
    Tab
    TabButton
    BorderButton
    BorderTab
    Layout --> LayoutInternal
    LayoutInternal --> Row
    LayoutInternal --> BorderTabSet
    Row --> TabSet
    Row --> Splitter
    TabSet --> Tab
    TabSet --> TabButton
    BorderTabSet --> BorderButton
    BorderTabSet --> BorderTab
end
```

Sources: [src/view/Layout.tsx L32-L166](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L32-L166)

 [src/view/Layout.tsx L485-L493](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L485-L493)

## Model Hierarchy

The model represents the layout as a hierarchical tree of nodes, with each node type serving a specific purpose.

```mermaid
flowchart TD

Model["Model"]
Root["Root (RowNode)"]
BorderSet["BorderSet"]
Row1["RowNode"]
TabSet1["TabSetNode"]
Row2["RowNode"]
TabSet2["TabSetNode"]
Tab1["TabNode"]
Tab2["TabNode"]
Tab3["TabNode"]
BorderN["BorderNode"]
BTab1["TabNode (in border)"]

subgraph subGraph0 ["Model Hierarchy"]
    Model
    Root
    BorderSet
    Row1
    TabSet1
    Row2
    TabSet2
    Tab1
    Tab2
    Tab3
    BorderN
    BTab1
    Model --> Root
    Model --> BorderSet
    Root --> Row1
    Root --> TabSet1
    Row1 --> Row2
    Row1 --> TabSet2
    TabSet1 --> Tab1
    TabSet1 --> Tab2
    TabSet2 --> Tab3
    BorderSet --> BorderN
    BorderN --> BTab1
end
```

Sources: [src/model/Model.ts L25-L100](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L25-L100)

 [src/model/TabNode.ts L11-L100](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts#L11-L100)

## Data Model Details

The Model class is the central manager for all layout nodes. It maintains:

1. A map of nodes indexed by their IDs
2. The root node (typically a RowNode)
3. Border settings
4. Window information (for popouts)

### Node Types

| Node Type | Purpose | Key Properties |
| --- | --- | --- |
| TabNode | Individual content panels | name, component, enableClose, enableDrag |
| TabSetNode | Container for multiple tabs | selected, enableTabStrip, enableMaximize |
| RowNode | Organizational container for layout | orientation, weight |
| BorderNode | Special edge region container | location, size, selected |

Sources: [src/model/Model.ts L28-L100](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L28-L100)

 [src/model/TabNode.ts L11-L424](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/TabNode.ts#L11-L424)

## JSON Model Structure

The layout model can be serialized to and deserialized from JSON, with a well-defined structure:

```mermaid
flowchart TD

IJsonModel["IJsonModel"]
Global["global: IGlobalAttributes"]
Layout["layout: IJsonRowNode"]
Borders["borders?: IJsonBorderNode[]"]
Popouts["popouts?: Record"]
Children["children: (IJsonRowNode | IJsonTabSetNode)[]"]
IJsonTabSetNode["IJsonTabSetNode"]
TabChildren["children: IJsonTabNode[]"]

subgraph subGraph0 ["JSON Model Structure"]
    IJsonModel
    Global
    Layout
    Borders
    Popouts
    Children
    IJsonTabSetNode
    TabChildren
    IJsonModel --> Global
    IJsonModel --> Layout
    IJsonModel --> Borders
    IJsonModel --> Popouts
    Layout --> Children
    IJsonTabSetNode --> TabChildren
end
```

Sources: [src/model/IJsonModel.ts L5-L42](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/IJsonModel.ts#L5-L42)

 [src/model/Model.ts L395-L446](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L395-L446)

## Action System

Actions are the primary mechanism for modifying the layout structure. All changes to the model happen through actions processed by the `doAction` method.

```mermaid
flowchart TD

Action["Action Creation"]
DoAction["Model.doAction()"]
Switch["Switch on action.type"]
Process["Process specific action"]
UpdateIDMap["Update ID Map"]
NotifyListeners["Notify change listeners"]

subgraph subGraph0 ["Action Processing Flow"]
    Action
    DoAction
    Switch
    Process
    UpdateIDMap
    NotifyListeners
    Action --> DoAction
    DoAction --> Switch
    Switch --> Process
    Process --> UpdateIDMap
    UpdateIDMap --> NotifyListeners
end
```

Sources: [src/model/Model.ts L70-L301](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L70-L301)

Common actions include:

* `addNode`: Add a new tab
* `moveNode`: Move a tab or tabset
* `deleteTab`: Remove a tab
* `maximizeToggle`: Toggle maximized state of a tabset
* `updateNodeAttributes`: Update node properties

## Lifecycle and Data Flow

The lifecycle of a FlexLayout instance follows these general stages:

1. **Initialization**: Model is created from JSON or programmatically
2. **Rendering**: Layout component renders the model
3. **User Interaction**: User actions trigger state changes
4. **Action Dispatch**: Actions are created and dispatched
5. **Model Update**: Model changes based on actions
6. **Re-rendering**: Components re-render to reflect changes

```mermaid
sequenceDiagram
  participant Application
  participant Layout Component
  participant Model
  participant Actions

  Application->>Model: Create from JSON
  Application->>Layout Component: Render with model
  loop [User Interaction]
    Layout Component->>Actions: Create action
    Actions->>Model: doAction(action)
    Model->>Model: Update model
    Model->>Layout Component: Notify changes
    Layout Component->>Application: Update UI
  end
```

Sources: [src/view/Layout.tsx L85-L166](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L85-L166)

 [src/model/Model.ts L70-L301](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L70-L301)

## Window Management

FlexLayout supports popout windows through a dedicated window management system:

```mermaid
flowchart TD

Model["Model"]
WindowsMap["windowsMap: Map"]
MainWindow["MAIN_WINDOW_ID: Layout"]
PopoutWindow1["PopoutWindow 1: Layout"]
PopoutWindow2["PopoutWindow 2: Layout"]

subgraph subGraph0 ["Window Management"]
    Model
    WindowsMap
    MainWindow
    PopoutWindow1
    PopoutWindow2
    Model --> WindowsMap
    WindowsMap --> MainWindow
    WindowsMap --> PopoutWindow1
    WindowsMap --> PopoutWindow2
end
```

Sources: [src/model/Model.ts L45-L49](https://github.com/caplin/FlexLayout/blob/40753f37/src/model/Model.ts#L45-L49)

 [src/view/Layout.tsx L530-L557](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L530-L557)

The window management system enables:

* Creating new windows via popout
* Synchronizing state between windows
* Moving tabs between windows
* Cleaning up empty windows

## Conclusion

FlexLayout's architecture is built around a clear separation of concerns, with the model handling data structure and logic while React components handle rendering. The action-based state management system ensures predictable changes to the layout, while the hierarchical node structure provides flexibility for complex layouts.

For more information on specific components, refer to [Core Components](/caplin/FlexLayout/3-core-components), and for details on the data model implementation, see [Data Model](/caplin/FlexLayout/4-data-model).