# Proteus Mod Manager (PMM) - Project Context & Guidelines

## 1. Project Overview

**Proteus Mod Manager (PMM)** is a modular, extensible game mod manager.
**Core Philosophy:** The core application is a generic "shell"; all game-specific logic MUST reside in isolated plugins.

**Tech Stack:**
- **Runtime:** Electron (Main + Preload + Renderer processes)
- **UI:** React + TypeScript + Tailwind CSS
- **Plugin Engine:** `vm2` (Sandboxed JavaScript execution)
- **Package Manager:** `pnpm`
- **Build Tool:** Electron Vite

---

## 2. Architectural Mandates (CRITICAL)

### Rule 2.1: Plugin-First Architecture
*This is the most important rule. Violating this breaks the core design.*

*   **Logic Isolation:** ALL game-specific logic (detection, installation, mod types) MUST be in `plugins/*.js`.
*   **Generic Main Process:** The `src/main/` code must remain game-agnostic.
    *   **Bad:** `if (gameId === 'cyberpunk') doSomething()` in `main.ts`
    *   **Good:** `await plugin.execute('doSomething')` in `main.ts` -> `doSomething()` defined in `plugins/cyberpunk.js`
*   **Extension Pattern:** If a new game needs a feature the core doesn't support:
    1.  Add a generic hook/method to `src/main/pluginLoader.ts`.
    2.  Implement the specific logic in the game's plugin.

### Rule 2.2: Process Boundaries & IPC
The application follows strict Electron security practices.

*   **Main Process (`src/main/`)**:
    *   Has full Node.js access.
    *   Manages file system, OS integration, and Plugin execution.
    *   Exposes functionality via `ipcMain.handle` (defined in `src/main/index.ts`).
*   **Renderer Process (`src/renderer/`)**:
    *   UI only (React).
    *   **NO** Node.js access.
    *   Requests actions via `window.electron` (IPC).
*   **Preload Script (`src/preload/`)**:
    *   The bridge. Exposes a safe `api` object to the window.

### Rule 2.3: Plugin Sandboxing (`vm2`)
Plugins run in a restricted environment for safety. They cannot `require` arbitrary Node modules.

*   **Allowed:** `path` module (for string manipulation).
*   **Disallowed:** `fs`, `child_process`, `os`, etc.
*   **The "Manager" API:** Plugins must use the injected `sandbox.manager` object for IO:
    *   `sandbox.manager.symlinkFile(src, dest)` **(PREFERRED for mods)**
    *   `sandbox.manager.downloadFile(url, dest)`
    *   `sandbox.manager.readDir(path)`
    *   `sandbox.manager.fileExists(path)`
    *   `sandbox.manager.deleteFile(path)`
    *   `sandbox.manager.showAlert(title, msg)`

---

## 3. Development Workflow

*   **Package Manager:** Always use `pnpm`.
*   **Start Dev Server:** `pnpm run dev`
*   **Type Checking:** `pnpm run typecheck` (Run this before confirming any task involving TS).
*   **Linting:** `pnpm run lint`

---

## 4. Plugin Development Specification

Plugins are JS files in `/plugins/` (e.g., `plugins/subnautica.js`).

### Required Exports
A plugin module must export a default object with these properties:

```javascript
module.exports.default = {
  id: 'gameid',              // Unique, lowercase, no spaces
  name: 'Game Name',
  version: '1.0.0',
  steamAppId: '12345',       // For auto-detection
  executable: 'bin/game.exe',// Relative to Game Root

  // Lifecycle Hooks
  detect: async (candidates) => { ... },
  prepareForModding: async (gamePath) => { ... },
  checkRequirements: async (gamePath) => { ... },
  install: async (source, dest, original) => { ... },
}
```

### Key Hooks
*   **`detect`**: Scans provided Steam library paths to find the game folder.
*   **`prepareForModding`**: Sets up mod loaders (e.g., BepInEx, REFramework). Use `sandbox.manager.downloadFile`.
*   **`install`**: The core logic. **Use Symlinks (`sandbox.manager.symlinkFile`)** whenever possible to avoid duplicating large files.

---

## 5. File Structure Reference

| Path | Purpose |
| :--- | :--- |
| `plugins/` | **Game Plugins.** (Edit here for game support) |
| `src/main/pluginLoader.ts` | **The Sandbox.** Defines what APIs plugins can access. |
| `src/main/index.ts` | **Main Entry.** IPC handlers & App lifecycle. |
| `src/renderer/src/App.tsx` | **UI Root.** |
| `src/renderer/src/utils/i18n.ts` | **Localization.** (En/Nl supported) |

---

## 6. Task Guides for the Agent

### When "Adding a New Game":
1.  **Analyze:** Find similar games in `plugins/` to copy patterns from.
2.  **Create:** New file `plugins/<id>.js`.
3.  **Implement:** `detect`, `prepareForModding`, `checkRequirements`, `install`.
4.  **Register:** Update `README.md` to list the new game.
5.  **Verify:** Ensure no hardcoded paths are added to `src/main`.

### When "Fixing a Bug":
1.  **Isolate:** Is it a UI bug (Renderer) or Logic bug (Main/Plugin)?
2.  **Logs:** Plugin errors are often caught/logged by `pluginLoader.ts`.
3.  **Fix:** Apply fix ensuring Process Boundaries are respected.

### When "Adding Features":
1.  **Extension:** If the feature requires new OS access (e.g., Registry read), add it to `src/main/pluginLoader.ts` first, then expose it to the sandbox.
