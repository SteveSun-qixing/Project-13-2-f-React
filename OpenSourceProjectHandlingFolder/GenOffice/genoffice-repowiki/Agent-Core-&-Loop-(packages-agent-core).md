# Agent Core & Loop (packages/agent-core)

> **Relevant source files**
> * [apps/docs/src/renderer/ai/continuation.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/continuation.ts)
> * [apps/docs/src/renderer/ai/protocol.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts)
> * [apps/docs/src/renderer/ai/transport.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts)

This page provides a deep dive into the `packages/agent-core` module, which is central to the AI functionality across the GenOffice suite. It covers the `AgentLoop` for multi-turn tool-calling, context management, the `AgentSkill` interface for defining AI capabilities, the `AgentTransport` abstraction for communication, and mechanisms for state snapshotting and rollback. It also details the `electron-transport` IPC bridge used in the Electron environment.

## The AgentLoop: Multi-Turn Tool-Calling and Context Management

The `AgentLoop` is the orchestrator for AI interactions, enabling multi-turn conversations and tool-calling. It manages the flow of information between the user, the AI model, and the available tools (skills).

### Core Responsibilities

* **Multi-Turn Conversation:** The `AgentLoop` maintains the chat history and allows for iterative interactions where the AI can ask clarifying questions or execute multiple tools to achieve a goal.
* **Tool-Calling:** It interprets the AI model's responses to identify tool calls, executes them, and feeds the tool outputs back into the model's context.
* **Context Compaction:** To manage token limits, the `AgentLoop` employs strategies to compact the conversation history and document context. This involves trimming older messages or summarizing content.
* **History Trimming:** When the conversation history exceeds a predefined limit, older messages are removed to keep the context window manageable for the AI model.
* **Snapshot and Rollback:** The loop supports taking snapshots of the application state before executing AI actions and rolling back to a previous state if an operation fails or is cancelled.

### AgentLoop Workflow

The `AgentLoop` operates by continuously processing user input and AI model responses.

```

```

Title: AgentLoop Workflow
Sources: [apps/docs/src/renderer/ai/protocol.ts L14-L20](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L14-L20)

 [apps/docs/src/renderer/ai/continuation.ts L1-L5](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/continuation.ts#L1-L5)

The `run` method is the primary entry point for initiating an AI interaction. It takes a prompt and manages the entire conversation flow, maintaining state across turns until the task is complete or the maximum turn count is reached.

### Context Budgets and Protocol

The AI protocol uses specific character budgets (roughly 4 characters per token) to keep the context size bounded. Previews are clipped and full content is pulled lazily by the agent using specific tools.

| Budget Constant | Value | Purpose |
| --- | --- | --- |
| `DOCS_AGENT_MAX_TURNS` | 50 | Limits the number of turns in a multi-turn tool-use loop [apps/docs/src/renderer/ai/continuation.ts L1](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/continuation.ts#L1-L1) |
| `SELECTION_MAX_CHARS` | 24,000 | Maximum characters for selected text context [apps/docs/src/renderer/ai/protocol.ts L24](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L24-L24) |
| `DOC_CONTEXT_MAX_CHARS` | 8,000 | Budget for the document skeleton/structure [apps/docs/src/renderer/ai/protocol.ts L25](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L25-L25) |
| `PREVIEW_MAX_CHARS` | 60 | Standard block preview length [apps/docs/src/renderer/ai/protocol.ts L26](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L26-L26) |
| `PREVIEW_TIGHT_CHARS` | 20 | Condensed preview length for dense lists [apps/docs/src/renderer/ai/protocol.ts L27](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L27-L27) |

Sources:

* [apps/docs/src/renderer/ai/continuation.ts L1-L5](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/continuation.ts#L1-L5)
* [apps/docs/src/renderer/ai/protocol.ts L14-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L14-L28)

## AgentSkill Interface

The `AgentSkill` interface defines the contract for tools that the AI agent can use. Each skill represents a specific capability or action the AI can perform within the application.

### Implementation Pattern

In GenOffice, skills are often defined by providing a Zod schema for input validation and an `action` function for execution. For example, the `apply_commands` tool in Docs uses a complex JSON envelope to batch updates to the document structure [apps/docs/src/renderer/ai/protocol.ts L34-L80](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L34-L80)

* **`name`**: A unique identifier for the skill (e.g., `read_blocks`, `apply_commands`).
* **`description`**: A natural language description used by the AI model to understand when to invoke the tool.
* **`schema`**: A Zod schema that defines the expected input parameters.
* **`action`**: The core function that implements the skill's logic.
* **`onRollback`**: An optional hook called if the loop is cancelled or errors, allowing for cleanup.

Common recipes for skills include `updateTextStyle`, `updateParagraphStyle`, `deleteBlocks`, and `moveBlocks` [apps/docs/src/renderer/ai/protocol.ts L60-L68](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L60-L68)

Sources:

* [apps/docs/src/renderer/ai/protocol.ts L34-L80](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L34-L80)
* [apps/docs/src/renderer/ai/protocol.ts L82-L86](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L82-L86)

## AgentTransport Abstraction

The `AgentTransport` interface abstracts the communication layer between the `AgentLoop` and the actual AI model provider. This allows the `AgentLoop` to be agnostic to the underlying AI service (e.g., OpenAI, Anthropic, Genspark).

### Transport Requirements

The transport must handle:

1. **Streaming**: Providing real-time updates via `onStream` [apps/docs/src/renderer/ai/transport.ts L8](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L8-L8)
2. **Lifecycle**: Starting requests and providing a mechanism to `cancel` them [apps/docs/src/renderer/ai/transport.ts L9-L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L9-L10)
3. **Settings**: Accessing API configuration via `getSettings` [apps/docs/src/renderer/ai/transport.ts L11](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L11-L11)
4. **Localization**: Providing localized error strings for timeouts or credit exhaustion [apps/docs/src/renderer/ai/transport.ts L12-L14](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L12-L14)

Sources:

* [apps/docs/src/renderer/ai/transport.ts L6-L16](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L6-L16)

## Snapshot and Rollback Hooks

The AI system incorporates snapshot and rollback mechanisms to ensure data integrity during complex multi-turn AI interactions.

* **Snapshots**: Before the AI applies a batch of commands (e.g., via `apply_commands`), the system can take a snapshot of the current state.
* **Rollbacks**: If the AI produces an invalid sequence of commands or if the user cancels the operation mid-stream, the system triggers `onRollback`. This is particularly important for the `docx-engine` to maintain byte-preserving fidelity.
* **Tool Discipline**: The protocol enforces discipline, requiring the agent to read the "document block list" before issuing commands to avoid addressing errors [apps/docs/src/renderer/ai/protocol.ts L70-L73](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L70-L73)

Sources:

* [apps/docs/src/renderer/ai/protocol.ts L70-L80](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L70-L80)

## Electron-Transport IPC Bridge

In the Electron environment, the `AgentTransport` is implemented using an Inter-Process Communication (IPC) bridge that connects the renderer process to the main process.

```

```

Title: Electron AI Transport Flow
Sources: [apps/docs/src/renderer/ai/transport.ts L6-L16](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L6-L16)

The `createElectronTransport` function wires the `AgentTransport` to the `window.desktop` bridge:

* **`onStream`**: Connects to `window.desktop.onAiStream` [apps/docs/src/renderer/ai/transport.ts L8](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L8-L8)
* **`start`**: Calls `window.desktop.aiStream` [apps/docs/src/renderer/ai/transport.ts L9](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L9-L9)
* **`cancel`**: Calls `window.desktop.aiStreamCancel` [apps/docs/src/renderer/ai/transport.ts L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L10-L10)

This architecture ensures that sensitive API keys and network logic remain in the Main process while the Agent logic and UI state management remain in the Renderer.

Sources:

* [apps/docs/src/renderer/ai/transport.ts L1-L16](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L1-L16)