# GenOffice PDF

> **Relevant source files**
> * [apps/docs/src/renderer/assets/file-pdf.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/file-pdf.png)

This page provides a high-level overview of the GenOffice PDF application, located in `apps/pdf`. This application serves as a PDF viewer and editor, built upon the powerful `pdf.js` library for rendering and `pdf-lib` for manipulation. It supports a range of features including annotations (freehand drawing, form fields, hyperlinks), stamps, digital signatures, outline navigation, search functionality, printing, and an autosave mechanism. Additionally, it integrates with the GenOffice AI system to provide intelligent assistance for PDF documents.

This is a parent page. For detailed technical information on specific components and functionalities, please refer to the linked child pages.

## PDF Viewer Architecture & Annotation Layers

The core of the PDF application resides in `apps/pdf/src/renderer`. This directory contains the main `App.tsx` component, which orchestrates the PDF rendering and interaction. The application leverages `pdf.js` to display PDF documents and `pdf-lib` for programmatic manipulation, such as adding annotations or form fields.

Key annotation layers are implemented to provide rich interactive capabilities:

* **DrawLayer**: Enables freehand ink annotations, allowing users to draw directly on the PDF pages.
* **FormLayer**: Manages interactive form fields within the PDF, allowing users to fill out and interact with PDF forms.
* **LinkLayer**: Handles hyperlinks embedded within the PDF, providing navigation capabilities.

Beyond these layers, the application includes various dialogs for specific functionalities, such as `StampDialog` for inserting stamps, `SignatureDialog` for applying digital signatures, and `PropertiesDialog` for viewing and editing document properties. Annotation management, stamp definitions, search logic, and print functionality are encapsulated in dedicated modules like `annotations.ts`, `stamps.ts`, `search.ts`, and `print.ts`. The `useAutosave` hook ensures that user changes are periodically saved.

For a deep dive into the renderer architecture, the implementation of these layers, and the associated dialogs and utilities, see [PDF Viewer Architecture & Annotation Layers](/genspark-ai/genoffice/6.1-pdf-viewer-architecture-and-annotation-layers).

Sources:

* [apps/pdf/src/renderer/App.tsx L1-L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/App.tsx#L1-L50)
* [apps/pdf/src/renderer/annotations.ts L1-L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/annotations.ts#L1-L30)
* [apps/pdf/src/renderer/stamps.ts L1-L20](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/stamps.ts#L1-L20)
* [apps/pdf/src/renderer/search.ts L1-L25](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/search.ts#L1-L25)
* [apps/pdf/src/renderer/print.ts L1-L20](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/print.ts#L1-L20)
* [apps/pdf/src/renderer/useAutosave.ts L1-L15](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/useAutosave.ts#L1-L15)

### PDF Application Structure

```

```

Sources:

* [apps/pdf/src/renderer/App.tsx L1-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/App.tsx#L1-L100)
* [apps/pdf/src/renderer/annotations.ts L1-L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/annotations.ts#L1-L50)
* [apps/pdf/src/renderer/stamps.ts L1-L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/stamps.ts#L1-L30)

## Outlines, Search, and Print

The GenOffice PDF application provides essential document navigation and interaction features. The `OutlinePanel` allows users to navigate through the document using its embedded outline or table of contents, enhancing usability for lengthy documents.

The search functionality, implemented in `search.ts`, enables users to find specific text within the PDF document. This feature typically highlights search results and provides navigation between occurrences.

Printing capabilities are handled by `print.ts`, which interfaces with the underlying `pdf.js` rendering to generate printable output. This ensures that the displayed PDF content, including any annotations, can be accurately printed.

Sources:

* [apps/pdf/src/renderer/search.ts L1-L40](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/search.ts#L1-L40)
* [apps/pdf/src/renderer/print.ts L1-L35](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/print.ts#L1-L35)

## Autosave and AI Integration

To prevent data loss, the PDF application incorporates an autosave mechanism. This is managed by the `useAutosave` hook, which periodically saves the current state of the PDF document, including any edits or annotations, ensuring that user progress is preserved even in unexpected application closures.

The GenOffice PDF application also integrates with the broader GenOffice AI system via `pdf-skill.ts`. This integration provides intelligent features, such as content analysis and summarization. The `AiPanel` for PDF documents offers a dedicated interface for interacting with these AI capabilities.

Sources:

* [apps/pdf/src/renderer/useAutosave.ts L1-L25](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/useAutosave.ts#L1-L25)
* [packages/agent-core/src/skills/pdf-skill.ts L1-L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/skills/pdf-skill.ts#L1-L50)

### PDF AI Integration

```

```

Sources:

* [apps/pdf/src/renderer/App.tsx L1-L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/App.tsx#L1-L50)
* [packages/agent-core/src/skills/pdf-skill.ts L1-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/skills/pdf-skill.ts#L1-L100)