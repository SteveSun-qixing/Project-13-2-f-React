# @chips/card-runtime

Card runtime iframe components:

- `EmbeddedDocumentFrame`
- `CardCoverFrame`
- `CompositeCardWindow`

Core helpers:

- `validateCardDisplayAdapter`
- `loadCoverFrameData`
- `loadCompositeWindowData`
- `parseCompositeFrameMessage`
- `resolveIframeSandboxPolicy`
- `isAllowedFrameOrigin`

SDK mode contract:

- `CompositeWindowMode.VIEW`
- `CompositeWindowMode.PREVIEW`

Composite iframe event contract:

- `ready`
- `resize`
- `node-error`
- `fatal-error`

Adapter contract (for SDK not-yet-available phase):

- `resolveCoverFrame({ cardId, cardFile, signal })`
- `resolveCompositeWindow({ cardFile, mode, signal })` (`mode` only supports `view | preview`)

Document iframe note:

- `EmbeddedDocumentFrame` is the controlled iframe base for box covers, box entry covers, and app-generated iframe regions.

SDK blocker tracking:

- `工单001-SDK-UNIFIED-CARD-DISPLAY-API`
