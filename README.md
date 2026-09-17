# BunVite

A zero-dependency Vite alternative powered purely by Bun. Dev server, HMR, Tailwind CSS v4, Sass/SCSS, and production bundler inside a single script (`vite.ts`). No npm install required.

## Quickstart

```bash
bunx degit BayramovNicat/bunvite my-app
cd my-app
bun run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Action |
| :--- | :--- |
| `bun run dev` | Start dev server with HMR (`--open` to launch browser) |
| `bun run build` | Build minified and hashed assets to `dist/` |
| `bun run preview` | Preview production build locally with gzip |
| `bun run test` | Run tests (`bun test`) |
| `bun run lint` | Lint code via Biome (`bunx biome check .`) |
| `bun run format` | Auto-format code via Biome |
| `bun run typecheck` | Run TypeScript check (`bunx tsc --noEmit`) |
| `bun run check` | Run typecheck, lint, and tests sequentially |

## What's Included

- **Zero dependencies:** No `vite`, `esbuild`, or heavy bundlers installed. Powered by native `Bun.serve` and `Bun.build`.
- **Tailwind CSS v4 & Sass:** Compiles on demand via `bunx @tailwindcss/cli` and `sass`, with disk caching in `.cache/`.
- **Fast HMR:** WebSocket hot reloading. Preserves state bound to `window.__hmr_state__` and keeps active input focus across reloads.
- **Environment variables:** Automatically loads `.env`. Any `VITE_*` variable is injected into `import.meta.env` and replaced in `index.html` (e.g. `%VITE_APP_TITLE%`).
- **API proxy:** Set `VITE_PROXY_TARGET=http://localhost:8080` in `.env` to route `/api/*` requests to your backend. Custom rules can be set in `CONFIG.proxy` in `vite.ts`.
- **Production build:** Hashes output (`app.[hash].js`, `style.[hash].css`), outputs size and gzip breakdown, and serves preview with immutable caching headers.

## Project Layout

```text
public/        Static assets (copied directly to dist/)
src/           Application code (app.ts) and styles (style.css)
test/          App and engine tests (app.test.ts, engine/vite.test.ts)
types/         Ambient Bun and env declarations (vite.d.ts)
index.html     HTML entrypoint
vite.ts        Dev server, bundler, and preview engine
```

## License

[MIT](LICENSE)
