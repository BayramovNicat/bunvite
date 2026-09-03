---
name: bunvite-guidelines
description: >-
  Architecture guide, standards, and rules for the BunVite development engine in this workspace.
  Explains the self-contained Bun dev engine (vite.ts), prevents installing npm vite or heavy bundlers,
  details HMR state preservation, API dev proxy, import.meta.env, asset serving, and build workflows.
---

# BunVite Architecture & Guidelines

This document details the architecture, conventions, and operational rules for working with the BunVite engine in this workspace.

---

## 1. Engine Core Principles

- **Never install `vite`, `webpack`, `rollup`, `esbuild`, or bundler plugins.**
- The root [`vite.ts`](file:///Users/nicat/Documents/antigravity/agitated-galileo/vite.ts) script is the entire dev server, HMR engine, and production bundler.
- It uses native Bun runtime APIs exclusively:
  - `Bun.serve` for HTTP, WebSocket, and duplex proxy handling.
  - `Bun.build` for client TypeScript compilation and production JS bundling.
  - `@tailwindcss/cli` executed through `Bun.spawn` for Tailwind CSS v4 compilation.
  - `Bun.hash` for 64-bit content ETags.
  - `Bun.gzipSync` for gzip calculation and production preview compression.
- `package.json` contains only one dev dependency (`tailwindcss`). Linter (`biome`) and TypeScript compiler (`tsc`) run on demand via `bunx`.

---

## 2. Scripts and Commands

Use the scripts defined in [`package.json`](file:///Users/nicat/Documents/antigravity/agitated-galileo/package.json):

| Command | Purpose | Details |
| :--- | :--- | :--- |
| `bun run dev` | Development server | `bun --watch run vite.ts dev`. Compiles on demand, streams HMR over `/ws-hmr`. Supports `--open` / `-o`. |
| `bun run build` | Production build | Cleans `dist/`, builds minified/hashed JS and CSS bundles, replaces `%VITE_*%` in `index.html`, outputs size summary. |
| `bun run preview` | Preview server | Serves `dist/` with gzip compression, `Cache-Control: immutable`, and SPA route fallback. Supports `--open` / `-o`. |
| `bun run test` | Run tests | Executes unit, integration, and WebKit DOM tests via `bun test --parallel`. |
| `bun run lint` | Lint check | Runs `bunx biome check .`. |
| `bun run format` | Code formatting | Runs `bunx biome format --write .`. |
| `bun run check:types` | Typecheck | Runs `bunx tsc --noEmit`. |
| `bun run check` | Full test suite | Concurrently runs typecheck, linting, and all tests in parallel. |

---

## 3. Type Declarations

All ambient declarations live in the root [`types/`](file:///Users/nicat/Documents/antigravity/agitated-galileo/types) folder. Keep `src/` free of `.d.ts` files.

- [`types/bun.d.ts`](file:///Users/nicat/Documents/antigravity/agitated-galileo/types/bun.d.ts): Minimal ambient interfaces for `Bun.serve`, `Bun.build`, `Bun.spawn`, `Bun.WebView`, and `bun:test`.
- [`types/env.d.ts`](file:///Users/nicat/Documents/antigravity/agitated-galileo/types/env.d.ts): Type definitions for `import.meta.env`.

---

## 4. Hot Module Replacement & State Preservation

### State Retention via `__hmr_state__`

The development compiler automatically preserves state across module reloads if bound to `window.__hmr_state__`:

```typescript
var state = (window.__hmr_state__ ??= {
  todos: [] as Todo[],
  filter: 'all' as Filter,
});
```

### Active Input Focus Retention

The HMR runtime records active focused input elements, their value, and cursor selection ranges before reloading modules, restoring them immediately after DOM swap.

### Stylesheet Hot-Swapping

Modifications to `src/style.css` trigger an in-memory CSS rebuild. The browser updates `<link rel="stylesheet">` tags with a timestamp parameter without reloading the document or losing JavaScript runtime state.

---

## 5. Tailwind CSS v4 Source Scoping

Tailwind v4 discovers and scans workspace files automatically. To prevent it from scanning documentation, markdown files, or tests (which inflates production CSS bundles), [`src/style.css`](file:///Users/nicat/Documents/antigravity/agitated-galileo/src/style.css) explicitly scopes input sources:

```css
@import "tailwindcss" source(none);
@source "../index.html";
@source "./";
```

VS Code CSS validation warnings on `source(none)` are suppressed via `css.validate: false` in [`.vscode/settings.json`](file:///Users/nicat/Documents/antigravity/agitated-galileo/.vscode/settings.json).

---

## 6. Environment Variables (`import.meta.env`)

- **Exposure rule:** Only variables with a `VITE_` prefix are bundled into client code or replaced in HTML templates.
- **Server safety:** System variables without `VITE_` remain on the server and are never exposed to browser bundles.
- **HTML injection:** Any `%VITE_VAR%` pattern in `index.html` is replaced with the corresponding variable value.

### Adding Variables

1. Add the key to [`.env`](file:///Users/nicat/Documents/antigravity/agitated-galileo/.env) and [`.env.example`](file:///Users/nicat/Documents/antigravity/agitated-galileo/.env.example):
   ```bash
   VITE_APP_NAME=My App
   ```
2. Declare the type in [`types/env.d.ts`](file:///Users/nicat/Documents/antigravity/agitated-galileo/types/env.d.ts):
   ```typescript
   declare interface ImportMetaEnv {
     readonly VITE_APP_NAME: string;
   }
   ```
3. Read in application code:
   ```typescript
   const title = import.meta.env.VITE_APP_NAME;
   ```

---

## 7. Static Assets

- Do not use JavaScript asset imports (`import img from './logo.png'`).
- Place static assets inside the [`public/`](file:///Users/nicat/Documents/antigravity/agitated-galileo/public) directory.
- Access assets using root-relative paths:
  ```html
  <img src="/logo.svg" alt="Logo" />
  ```
- Assets in `public/` are served directly in development and copied to `dist/` during build.

---

## 8. API Dev Proxy

Proxy requests to local backend APIs by defining `VITE_PROXY_TARGET` in [`.env`](file:///Users/nicat/Documents/antigravity/agitated-galileo/.env):

```bash
VITE_PROXY_TARGET=http://localhost:8080
```

Requests to `/api/*` are forwarded to the target URL with headers preserved, query parameters forwarded, and full request body streaming. Custom route rewrites can be added to `CONFIG.proxy` in [`vite.ts`](file:///Users/nicat/Documents/antigravity/agitated-galileo/vite.ts).
