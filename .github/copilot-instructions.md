# Proteus Mod Manager (PMM) AI Coding Instructions

You are working on **Proteus Mod Manager (PMM)**, a modular, extensible mod manager application built with **Electron**, **React**, and **TypeScript**.

## Architectural Principles

- **Plugin-First Design (CRITICAL)**: The application is game-agnostic. All game-specific logic (detection, mod installation paths, load order, config handling) MUST reside in javascript plugins located in `plugins/`.
  - **NEVER** hardcode game-specific rules (like "if game is cyberpunk") in the main application code only in plugins.
  - If a new feature is needed for a game, extend the plugin API in `src/main/pluginLoader.ts` and implement the logic in the specific game plugin.
- **Sandboxing**: Plugins run in a `vm2` sandbox. They do not have direct Node.js access. They MUST communicate with the host via the injected `sandbox.manager` API.
- **Boundaries**:
  - **Main Process** (`src/main`): Handles OS interactions, file system, and plugin execution (via `pluginLoader.ts`).
  - **Renderer** (`src/renderer`): React UI. Communicates with Main ONLY via `window.electron` (exposed by Preload).
  - **Preload** (`src/preload`): Defines the IPC bridge.

## Core Workflows

- **Package Manager**: Use `pnpm`.
- **Type Checking**: ALWAYS run `pnpm run typecheck` to validate changes. The project is split into Node (Main) and Web (Renderer) contexts.
- **Starting Dev**: `pnpm run dev` starts the Electron dev server.

## Code Conventions

### Plugin API

- **Location**: `plugins/*.js` or `plugins/*/index.js`.
- **Structure**: Default export object with `id`, `name`, `lifecycle hooks`.
- **Reference**: See `README.md` for the latest plugin API signature.
- **Modularity**: When adding capabilities (e.g., specific file parsing), add a generic method to `pluginLoader.ts` that plugins can implement (e.g., `parseModConfig()`), rather than adding the logic to the loader itself.

### IPC Communication

1.  **Define**: Add method to `PluginManager` or `SettingsManager` in `src/main/`.
2.  **expose**: Add `ipcMain.handle` in `src/main/index.ts`.
3.  **Bridge**: Add function to `api` object in `src/preload/index.ts`.
4.  **Type**: Usage in Renderer is via `(window as any).electron`. _Note: Ideally this would be typed, but currently relies on manual syncing._

### React / UI

- **Components**: Functional components with Hooks.
- **Styling**: Tailwind CSS.
- **State**: React `useState`/`useEffect`. Global state is often minimal; data is fetched from Main process on demand.

## Key Files

- `src/main/pluginLoader.ts`: The heart of the extension system. Manages `vm2` instances and exposes API to plugins.
- `src/renderer/src/App.tsx`: Main UI entry point and layout.
- `plugins/`: Directory containing the game specific logic. Read existing plugins here to understand how to implement game support.

## Common Tasks

- **Adding a new game**: Create `plugins/<game_id>.js`. Implement detection and installation logic.
- **Adding a generic feature**:
  1.  Update `src/main/pluginLoader.ts` to support the new hook.
  2.  Update plugins to utilize the hook.
  3.  Expose any necessary UI triggers via IPC.
