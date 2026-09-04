# Monorepo Structure & Build System

> **Relevant source files**
> * [.gitignore](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/.gitignore)
> * [doc/vite.config.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/vite.config.ts)
> * [examples/vanilla/vite.config.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/vanilla/vite.config.ts)
> * [package.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/package.json)
> * [packages/core/README.md](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/README.md?plain=1)
> * [packages/core/package.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/package.json)
> * [pnpm-lock.yaml](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/pnpm-lock.yaml)
> * [pnpm-workspace.yaml](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/pnpm-workspace.yaml)
> * [scripts/check-package-exports.mjs](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/scripts/check-package-exports.mjs)
> * [tsconfig.base.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/tsconfig.base.json)
> * [vitest.config.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.config.ts)

This page details the architectural layout of the Open File Viewer monorepo, the pnpm-based workspace management, and the build pipeline used to distribute framework-agnostic and framework-specific packages.

## Workspace Layout

The project uses a **pnpm workspace** to manage multiple packages within a single repository. This allows for shared development dependencies, cross-package linking without publishing to npm, and unified testing.

### Directory Structure

| Path | Purpose | Key Entities |
| --- | --- | --- |
| `packages/core` | Framework-agnostic engine | `createViewer`, `PreviewPlugin` |
| `packages/react` | React adapter | `FileViewer` component |
| `packages/vue` | Vue adapter | `OpenFileViewer` component |
| `packages/svelte` | Svelte adapter | `OpenFileViewer.svelte` |
| `doc` | Documentation & Playground | `vite.config.ts`, `index.html` |
| `examples/*` | Framework-specific demos | `example-vanilla`, `example-react`, etc. |
| `scripts` | Maintenance utilities | `check-package-exports.mjs` |

**Sources:** [pnpm-workspace.yaml L1-L5](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/pnpm-workspace.yaml#L1-L5)

 [package.json L16-L30](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/package.json#L16-L30)

 [packages/core/package.json L1-L4](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/package.json#L1-L4)

### Dependency Graph & Linking

Internal packages reference each other using the `workspace:*` protocol. This ensures that the local source code is used during development and testing rather than the published npm versions.

**Monorepo Dependency Flow**

```

```

**Sources:** [pnpm-lock.yaml L56-L58](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/pnpm-lock.yaml#L56-L58)

 [pnpm-lock.yaml L75-L80](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/pnpm-lock.yaml#L75-L80)

 [pnpm-lock.yaml L128-L130](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/pnpm-lock.yaml#L128-L130)

## Build Pipeline

The project utilizes `tsup` for bundling the core and adapter packages, and `vite` for the documentation and examples.

### tsup Build Configuration

The `@open-file-viewer/core` package uses `tsup` to generate multiple output formats from `src/index.ts`:

* **ESM**: `./dist/index.js` for modern bundlers.
* **CJS**: `./dist/index.cjs` for Node.js compatibility.
* **DTS**: `./dist/index.d.ts` for TypeScript type definitions.

The build script also manually copies the CSS design system: `cp src/style.css dist/style.css`.

**Sources:** [packages/core/package.json L16-L28](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/package.json#L16-L28)

 [packages/core/package.json L37](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/package.json#L37-L37)

### Development Aliasing

To facilitate rapid development without constant rebuilding, `vite.config.ts` and `tsconfig.base.json` use path aliasing to point directly to source files.

| Tool | Configuration File | Path Mapping |
| --- | --- | --- |
| **Vite** | `doc/vite.config.ts` | `@open-file-viewer/core` -> `../packages/core/src/index.ts` |
| **TypeScript** | `tsconfig.base.json` | `@open-file-viewer/core` -> `packages/core/src/index.ts` |
| **Vitest** | `vitest.config.ts` | `@open-file-viewer/react` -> `./packages/react/src/index.tsx` |

**Sources:** [doc/vite.config.ts L15-L22](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/vite.config.ts#L15-L22)

 [tsconfig.base.json L15-L20](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/tsconfig.base.json#L15-L20)

 [vitest.config.ts L7-L15](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.config.ts#L7-L15)

## Validation & Quality Control

### Export Verification

The `check-package-exports.mjs` script is a critical part of the CI pipeline. It iterates through all packages and verifies that every file declared in the `package.json` `exports`, `main`, `module`, and `types` fields actually exists in the `dist` folder.

**Implementation Logic:**

1. Read `package.json` from `packages/*`.
2. Collect all paths from `main`, `module`, `types`, and the recursive `exports` object.
3. Use `fs.existsSync` to verify the presence of the built artifact.
4. Exit with code 1 if any file is missing.

**Sources:** [scripts/check-package-exports.mjs L10-L34](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/scripts/check-package-exports.mjs#L10-L34)

 [scripts/check-package-exports.mjs L40-L53](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/scripts/check-package-exports.mjs#L40-L53)

### Build Command Orchestration

The root `package.json` defines a comprehensive `check` script that ensures the entire monorepo is healthy:
`pnpm test && pnpm typecheck && pnpm build && pnpm build:examples && pnpm build:doc && pnpm pack:check`.

**Sources:** [package.json L16-L23](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/package.json#L16-L23)

## Technical Entity Mapping

The following diagram maps the high-level build concepts to the specific files and configurations that implement them.

**Build System Entity Map**

```

```

**Sources:** [package.json L1-L48](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/package.json#L1-L48)

 [packages/core/package.json L37](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/package.json#L37-L37)

 [scripts/check-package-exports.mjs L5-L13](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/scripts/check-package-exports.mjs#L5-L13)

 [tsconfig.base.json L1-L23](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/tsconfig.base.json#L1-L23)