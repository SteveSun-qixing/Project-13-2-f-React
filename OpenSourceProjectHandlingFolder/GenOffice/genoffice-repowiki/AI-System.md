# AI System

> **Relevant source files**
> * [apps/docs/src/renderer/ai/AiPanel.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx)
> * [apps/docs/src/renderer/ai/docs-skill.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts)
> * [apps/docs/src/renderer/ai/tools.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts)

The AI system in GenOffice provides intelligent assistance across all six applications (Docs, Sheets, Slides, PDF, Markdown, and Shell). It is built around a core agent loop that leverages a flexible skill composition mechanism, abstracts AI providers, and uses a dedicated transport layer for inter-process communication. Each application integrates this AI architecture through its own AI panel, offering context-aware tools and interactions.

This page provides a high-level overview of these components. For detailed technical information, refer to the linked child pages.

## Agent Loop

At the heart of the AI system is the agent loop, implemented in `packages/agent-core`. This loop orchestrates multi-turn conversations with the AI model, managing context, executing tools, and trimming conversation history to stay within token limits. The `AgentLoop` class [packages/agent-core/src/agent-loop.ts L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/agent-loop.ts#L100-L100)

 is responsible for this process. It takes user input, constructs a prompt with relevant document context and available tools, sends it to the AI provider, and then processes the AI's response, which might involve tool calls or direct text generation.

The agent loop is designed to be robust, handling streaming responses, error conditions, and allowing for snapshot and rollback mechanisms to manage document state during AI-driven edits.

For a deep dive into the `AgentLoop`, context compaction, history trimming, and the `AgentTransport` abstraction, see [Agent Core & Loop (packages/agent-core)](/genspark-ai/genoffice/8.1-agent-core-and-loop-(packagesagent-core)).

Sources:

* [packages/agent-core/src/agent-loop.ts L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/agent-loop.ts#L100-L100)

## Skill Composition

The AI's capabilities are extended through a system of "skills." An `AgentSkill` [packages/agent-core/src/agent-skill.ts L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/agent-skill.ts#L10-L10)

 defines a set of tools and a `systemPrompt` that guides the AI's behavior within that skill's domain. Skills are composed together to provide the AI with a comprehensive understanding of the application's functionality. For example, `createDocsSkill` [apps/docs/src/renderer/ai/docs-skill.ts L11-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L11-L28)

 in GenOffice Docs registers document-specific tools like `read_blocks` and `apply_commands` [apps/docs/src/renderer/ai/tools.ts L36-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L36-L100)

This modular approach allows each application to define its own set of AI-powered functionalities while reusing the core agent infrastructure. The `composeSkills` function [packages/agent-core/src/agent-loop.ts L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/agent-loop.ts#L100-L100)

 is used to combine multiple skills into a single agent.

For detailed information on app-specific AI skill implementations, see [Per-App AI Skills & Tools](/genspark-ai/genoffice/8.3-per-app-ai-skills-and-tools).

Sources:

* [packages/agent-core/src/agent-skill.ts L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/agent-skill.ts#L10-L10)
* [apps/docs/src/renderer/ai/docs-skill.ts L11-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L11-L28)
* [apps/docs/src/renderer/ai/tools.ts L36-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L36-L100)

## AI Providers & Search

The AI system abstracts away the underlying AI models through the `packages/ai-provider` module. This module provides a unified interface for interacting with various large language models (LLMs), including Genspark's own proxy, Anthropic, Gemini, OpenAI, and DeepSeek. It handles streaming chat, HTTP error handling, and manages `AiSettings`.

The `packages/ai-search` module provides tools for web and image search, integrating with Genspark's authentication to enable these capabilities. These search tools (e.g., `web_search`, `image_search`) are exposed to the AI agent as skills [apps/docs/src/renderer/ai/tools.ts L102-L126](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L102-L126)

 allowing it to fetch external information when needed.

For a detailed explanation of the provider abstraction, streaming chat, error handling, and the search tools, see [AI Providers & Search (packages/ai-provider, ai-search)](/genspark-ai/genoffice/8.2-ai-providers-and-search-(packagesai-provider-ai-search)).

Sources:

* [apps/docs/src/renderer/ai/tools.ts L102-L126](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L102-L126)

## Transport Layer

Communication between the renderer process (where the AI panel and agent loop reside) and the main Electron process (which handles network requests and file access) is managed by a dedicated transport layer. The `AgentTransport` interface [packages/agent-core/src/agent-transport.ts L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/agent-transport.ts#L10-L10)

 defines the contract for this communication.

In GenOffice, `createElectronTransport` [apps/docs/src/renderer/ai/transport.ts L6-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L6-L13)

 is used to establish an IPC bridge, leveraging Electron's `window.desktop` API for secure and typed communication.

Sources:

* [packages/agent-core/src/agent-transport.ts L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/agent-transport.ts#L10-L10)
* [apps/docs/src/renderer/ai/transport.ts L6-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L6-L13)

## Per-App AI Panels

Each GenOffice application integrates the AI system through its own AI panel. These panels, such as `AiPanel.tsx` [apps/docs/src/renderer/ai/AiPanel.tsx L1-L42](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L1-L42)

 in GenOffice Docs, provide the user interface for interacting with the AI. They manage chat history, display `ToolActivity` chips [apps/docs/src/renderer/ai/AiPanel.tsx L34-L42](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L34-L42)

 allow users to attach files via `createFilesSkill` [apps/docs/src/renderer/ai/AiPanel.tsx L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L13-L13)

 and present AI-generated content.

The following diagram illustrates the high-level architecture of the AI system.

```

```

Title: AI System Architecture Overview
Sources:

* [apps/docs/src/renderer/ai/AiPanel.tsx L1-L42](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L1-L42)
* [apps/docs/src/renderer/ai/docs-skill.ts L11-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L11-L28)
* [packages/agent-core/src/agent-loop.ts L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/agent-loop.ts#L100-L100)
* [apps/docs/src/renderer/ai/transport.ts L6-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/transport.ts#L6-L13)

### AI Panel in GenOffice Docs

The `AiPanel` in GenOffice Docs [apps/docs/src/renderer/ai/AiPanel.tsx L1-L42](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L1-L42)

 manages the UI state, including `ChatEntry` history [apps/docs/src/renderer/ai/AiPanel.tsx L60-L76](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L60-L76)

 and document snapshots for rollbacks. It uses `AiComposer` and `AiTypingIndicator` [apps/docs/src/renderer/ai/AiPanel.tsx L17](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L17-L17)

 from the `@genoffice/ui` package.

The following diagram illustrates the interaction flow within the Docs AI Panel, bridging natural language to code entities.

```

```

Title: Docs AI Panel Interaction Flow
Sources:

* [apps/docs/src/renderer/ai/AiPanel.tsx L60-L76](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L60-L76)
* [apps/docs/src/renderer/ai/docs-skill.ts L11-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L11-L28)
* [apps/docs/src/renderer/ai/tools.ts L28-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L28-L100)
* [apps/docs/src/renderer/ai/protocol.ts L3](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L3-L3)