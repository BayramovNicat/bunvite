---
name: bunvite-guidelines
description: >-
  Architecture guide, standards, and rules for the BunVite development engine in this workspace.
  Explains the zero-dependency Bun dev engine (vite.ts), prevents installing npm vite or heavy bundlers,
  details HMR state preservation, API dev proxy, import.meta.env, asset serving, and build workflows.
---

# BunVite Architecture & Development Guidelines

This skill documents the architecture, conventions, and rules for working with the **BunVite engine** in this repository.

---

## 1. Core Rule: Zero External Bundler Runtime

- **NEVER install `vite`, `webpack`, `rollup`, `esbuild`, or bundler plugins.**
- The file [`vite.ts`](file:///Users/nicat/Documents/antigravity/agitated-galileo/vite.ts) in the workspace root **is** the complete dev server, HMR engine, and production bundler.
- It is built 100% natively on **[Bun](https://bun.sh)** APIs:
  - `Bun.serve` for the HTTP, WebSocket, and duplex proxy server.
  - `Bun.build` for in-memory TypeScript compilation and production JS bundling.
  - `@tailwindcss/cli` invoked via `Bun.spawn` for Tailwind CSS v4 compilation.
  - `Bun.hash` for 64-bit content ETags and `Bun.gzipSync` for compression.

---

## 2. CLI Commands & Execution Flow

Always use the existing scripts defined in [`package.json`](file:///Users/nicat/Documents/antigravity/agitated-galileo/package.json):

| Command           | Action                   | Engine Internals                                                                                                                                                          |
| :---------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bun run dev`     | Starts dev server        | Spawns `bun --watch run vite.ts dev`. Watches files, compiles on demand, serves live HMR over WebSocket (`/ws-hmr`). Supports `--open` / `-o`.                            |
| `bun run build`   | Builds production bundle | Cleans `dist/`, runs `Bun.build` with minification + hashing, compiles Tailwind CSS v4, replaces `%VITE_*%` in `index.html`, and prints uncompressed & gzip size summary. |
| `bun run preview` | Previews `dist/`         | Serves `dist/` with on-the-fly gzip compression, `Cache-Control: immutable`, and SPA fallback routing. Supports `--open` / `-o`.                                          |
| `bun run test`    | Runs test suite          | Runs 40+ tests across DOM E2E and engine parity suites in ~1s.                                                                                                            |
| `bun run check`   | Typecheck, lint & tests  | Runs `tsc`, `biome check`, and `bun test` concurrently in parallel.                                                                                                       |

---

## 3. Hot Module Replacement (HMR) & State Preservation

When modifying or creating client code in `src/`:

### 1. State Preservation via `__hmr_state__`

The dev server transforms state variables to attach to `window.__hmr_state__` during compilation:

```typescript
// ✅ Correct: State survives HMR module reload without resetting user data
var state = (window.__hmr_state__ ??= {
  todos: [] as Todo[],
  filter: 'all' as Filter,
});
```

### 2. Active Input Focus Preservation

The client HMR runtime automatically captures the active focused input (`#todo-input`), its text value, and selection cursor (`selectionStart` / `selectionEnd`), and restores them after replacing the module in the DOM. Maintain standard input IDs where focus preservation is required.

### 3. Stylesheet Hot-Swapping

Editing `src/style.css` compiles Tailwind CSS in memory and notifies the browser. The browser swaps `<link rel="stylesheet">` tags with timestamp query strings (`?t=...`) without reloading the page or losing JavaScript state.

---

## 4. Environment Variables (`import.meta.env`)

- **Prefix Rule:** Only environment variables prefixed with `VITE_` are exposed to client-side code and HTML templates.
- **Server Variables:** Non-prefixed variables (`PORT`, `DATABASE_URL`) remain strictly on the server and are never bundled into client output.
- **HTML Token Replacement:** Tokens like `%VITE_APP_TITLE%` in `index.html` are automatically replaced at compile/build time.

### Adding New Environment Variables:

1. Add the variable to [`.env`](file:///Users/nicat/Documents/antigravity/agitated-galileo/.env) (and [`.env.example`](file:///Users/nicat/Documents/antigravity/agitated-galileo/.env.example)):
   ```bash
   VITE_NEW_FEATURE=true
   ```
2. Augment the TypeScript declaration in [`src/env.d.ts`](file:///Users/nicat/Documents/antigravity/agitated-galileo/src/env.d.ts):
   ```typescript
   declare interface ImportMetaEnv {
     readonly VITE_NEW_FEATURE: string;
   }
   ```
3. Use in TypeScript:
   ```typescript
   if (import.meta.env.VITE_NEW_FEATURE === 'true') {
     // ...
   }
   ```

---

## 5. Static Assets (`public/` Directory)

- **Do NOT use `import img from './logo.png'` in TypeScript.**
- Place all static files (images, icons, fonts, `robots.txt`) in the [`public/`](file:///Users/nicat/Documents/antigravity/agitated-galileo/public) directory.
- Reference them with root-relative paths in HTML and TypeScript:
  ```html
  <img src="/logo.svg" alt="App Logo" />
  ```
  ```typescript
  avatarElement.src = '/icons/user.svg';
  ```
- **Dev:** Assets in `public/` are served immediately.
- **Build:** All contents of `public/` are copied recursively to `dist/`.

---

## 6. Development API Proxy (`server.proxy`)

To bypass browser CORS when connecting to a local backend API:

### Method A: Zero-Code `.env` Proxy

Set `VITE_PROXY_TARGET` in [`.env`](file:///Users/nicat/Documents/antigravity/agitated-galileo/.env):

```bash
VITE_PROXY_TARGET=http://localhost:8080
```

Any frontend request to `/api/*` (e.g. `fetch('/api/tasks')`) is automatically forwarded to `http://localhost:8080/api/tasks`.

### Method B: Custom Proxy Rules in `vite.ts`

Configure `CONFIG.proxy` in [`vite.ts`](file:///Users/nicat/Documents/antigravity/agitated-galileo/vite.ts):

```typescript
export const CONFIG = {
  // ...
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '/v1'),
    },
  },
};
```

The proxy uses native duplex streaming (`duplex: 'half'`), preserves query strings, forwards custom headers, and returns `502 Bad Gateway` if the backend is down.

---

## 7. Dev Server Protocols & Performance

- **ETags & 304 Not Modified:** Every dev request generates a 64-bit content ETag (`Bun.hash`). Unchanged files return `304 Not Modified` with 0 body bytes.
- **Dev CORS:** All dev responses send `Access-Control-Allow-Origin: *` and handle `OPTIONS` preflight requests (status 204).
- **Port Collision Handling:** If port `5173` is occupied, `vite.ts` automatically increments to `5174`, `5175`, etc.
- **SPA Routing:** Unknown non-file paths automatically fall back to `index.html`.
