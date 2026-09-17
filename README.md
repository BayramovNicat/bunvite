# BunVite Starter

A minimal, zero-runtime-dependency frontend development engine and production bundler built on Bun, TypeScript, and Tailwind CSS v4.

Replaces standard npm Vite with a single self-contained script (`vite.ts`) utilizing native Bun APIs for development, hot module reloading, and production bundling.

---

## Features

- **Dev Server & HMR:** Module hot-reloading over WebSocket, in-memory TypeScript transforms, stylesheet hot-swapping, and active input focus preservation.
- **Tailwind CSS v4:** Direct integration with `@tailwindcss/cli` via `Bun.spawn`, with in-memory caching and scoped source scanning.
- **Error Overlay:** Terminal-style in-browser overlay displaying syntax errors with file paths, line/column positions, and codeframes.
- **Environment Variables:** Automatic loading of `.env` files with `import.meta.env` exposure for `VITE_*` prefixes and `%VITE_*%` HTML substitution.
- **API Dev Proxy:** Request forwarding for `/api/*` to backend endpoints with path rewrites, headers, and streaming duplex bodies.
- **Port Handling:** Automatic port collision detection and incrementing when `5173` is busy.
- **Conditional Caching:** 64-bit content ETags (`Bun.hash`) returning `304 Not Modified` during dev reloads.
- **Dev CORS:** Permissive headers (`Access-Control-Allow-Origin: *`) and `OPTIONS` preflight handling.
- **Static Assets:** Direct serving from `public/` during development and recursive copy to `dist/` on build.
- **Production Pipeline:** Content-hashed bundles (`app.[hash].js`, `style.[hash].css`), minification, build size summary with gzip breakdown, and preview server with gzip compression and immutable caching headers.

---

## Project Structure

```text
├── public/                # Static assets copied directly to dist/
│   └── robots.txt
├── src/
│   ├── app.ts             # Application entrypoint
│   └── style.css          # Tailwind CSS v4 stylesheet
├── test/
│   ├── todo.test.ts       # WebKit DOM E2E tests
│   └── vite.test.ts       # Engine, proxy, and integration tests
├── types/
│   ├── bun.d.ts           # Ambient Bun and test runner typings
│   └── env.d.ts           # Type definitions for import.meta.env
├── .editorconfig          # Indentation and formatting rules
├── .env.example           # Environment variable template
├── .prettierrc.json       # Prettier formatting config
├── biome.json             # Biome linter and formatter config
├── index.html             # HTML entrypoint
├── package.json           # Scripts and minimal dev dependencies
├── tsconfig.json          # TypeScript compiler configuration
├── bench.ts               # Production build benchmark script
└── vite.ts                # Dev server, bundler, and preview engine
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.2 or higher)
- Optional (for fastest builds): Tailwind CSS v4 CLI installed globally:
  ```bash
  bun add -g @tailwindcss/cli
  # or: npm install -g @tailwindcss/cli
  # or: pnpm add -g @tailwindcss/cli
  # or: brew install tailwindcss
  ```
  *(If omitted, Bun automatically runs `@tailwindcss/cli` on-demand via `bunx` with zero repo overhead.)*

### Quickstart

```bash
# 1. Scaffold a clean copy of the starter
bunx degit BayramovNicat/bunvite my-new-app

# 2. Navigate into your project
cd my-new-app

# 3. Start development server immediately (zero install needed!)
bun run dev
```

---

## Available Scripts

| Command | Action |
| :--- | :--- |
| `bun run dev` | Starts dev server at `http://localhost:5173/` (`--open` or `-o` to launch browser) |
| `bun run build` | Compiles hashed, minified production assets into `dist/` with gzip summary |
| `bun run bench` | Benchmarks production build pipeline across iterations with stage breakdown |
| `bun run preview` | Serves `dist/` locally with gzip compression and immutable caching |
| `bun run test` | Runs the test suite via `bun test --parallel` |
| `bun run lint` | Checks code formatting and lints via Biome |
| `bun run format` | Formats all files according to Biome rules |
| `bun run check:types` | Runs typecheck without emitting files (`bunx tsc --noEmit`) |
| `bun run check` | Runs type checking, linting, and tests in parallel |

---

## Configuration

### Environment Variables

Define variables in `.env` (refer to [`.env.example`](.env.example)):

```bash
# Variables prefixed with VITE_ are exposed to client code and HTML templates
VITE_API_URL=https://api.example.com
VITE_APP_TITLE=My Application

# Optional: target URL for dev server /api proxy
VITE_PROXY_TARGET=http://localhost:8080
```

Usage in client code:

```typescript
console.log(import.meta.env.VITE_API_URL);
console.log(import.meta.env.DEV);
```

Usage in [`index.html`](index.html):

```html
<title>%VITE_APP_TITLE%</title>
```

### API Dev Proxy

Proxy rules can be defined via `VITE_PROXY_TARGET` in `.env` or customized in [`vite.ts`](vite.ts) under `CONFIG.proxy`:

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

---

## Code Style

- **Indentation:** 2 spaces, enforced by `.editorconfig` and `biome.json`.
- **Quotes:** Single quotes for TypeScript/JavaScript, double quotes for HTML/SVG attributes.
- **Type Checking:** Strict TypeScript with types isolated in `types/`.

---

## License

MIT
