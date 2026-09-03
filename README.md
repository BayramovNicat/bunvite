# ⚡ BunVite Starter

A lightweight, zero-dependency Vite-like development engine and production bundler built 100% natively on **[Bun](https://bun.sh)** with **TypeScript** and **Tailwind CSS v4**.

Designed as a clean, radical-simplicity starter template for modern frontend applications without the weight of heavy bundler toolchains.

---

## ✨ Features

- **⚡ Instant Dev Server & HMR:** On-the-fly TypeScript bundling with in-browser live reload, stylesheet hot-swapping without page refresh, state preservation (`__hmr_state__`), and active input focus/selection preservation across module reloads.
- **🎨 Tailwind CSS v4:** First-class `@tailwindcss/cli` integration with on-demand compilation, in-memory caching, and sub-millisecond updates.
- **🛑 In-Browser Error Overlay:** Vite-style frosted glass overlay displaying exact syntax errors with file paths, line/column numbers, codeframes, caret pointers (`^`), and `Escape` key dismissal.
- **🔤 `import.meta.env` & `.env`:** Built-in support for `.env` files, `DEV`, `PROD`, `MODE`, `BASE_URL`, client-side `VITE_*` variable injection, `%VITE_*%` HTML placeholders, and typed definitions in `src/env.d.ts`.
- **🔀 API Dev Proxy (`server.proxy`):** Forward `/api/*` requests to your backend server with path rewrites, header forwarding, streaming request bodies, and `VITE_PROXY_TARGET` `.env` configuration.
- **🔌 Automatic Port Collision Handling:** Automatically detects occupied ports (e.g. `5173`) and binds to the next available port (`5174`, `5175`, etc.).
- **🏷️ ETags & 304 Not Modified:** Generates 64-bit content ETags for dev assets and responds with `304 Not Modified` on unchanged files, eliminating redundant re-transfers.
- **🛡️ Dev CORS Headers:** Automatically sets `Access-Control-Allow-Origin: *` and handles `OPTIONS` preflight requests for Web Workers, iframes, and local micro-frontends.
- **🌐 `public/` Directory Serving:** Root-relative static assets served seamlessly during development and copied recursively to `dist/` on build.
- **🗺️ SPA Fallback:** Unknown client-side paths automatically fall back to `index.html` for clean single-page app routing.
- **📦 Production Pipeline:** Content-hashed JavaScript (`app.[hash].js`) and CSS (`style.[hash].css`), minification, and an immutable-cached preview server (`max-age=31536000, immutable`) with gzip compression.
- **🧪 44 Automated Tests:** Full test suite covering all engine capabilities, parity features, and WebKit DOM E2E workflows running in **~1.5s**.

---

## 📁 Project Structure

```text
├── public/                # Static assets copied directly to dist/
│   └── robots.txt
├── src/
│   ├── app.ts             # Application entrypoint
│   ├── env.d.ts           # Type definitions for import.meta.env
│   └── style.css          # Tailwind CSS v4 stylesheet
├── test/
│   ├── todo.test.ts       # WebKit DOM E2E tests
│   └── vite.test.ts       # Engine, parity, proxy & env integration tests
├── .editorconfig          # Universal editor formatting (2 spaces)
├── .env.example           # Example environment variables template
├── .prettierrc.json       # Prettier configuration (single quotes, 2 spaces)
├── biome.json             # Biome linter & formatter configuration
├── index.html             # HTML entrypoint
├── package.json
├── tsconfig.json          # Strict TypeScript configuration
└── vite.ts                # Dev server, bundler & preview engine (100% Bun)
```

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.2+ recommended)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd <repo-name>

# Install dependencies
bun install
```

---

## 🛠️ Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `bun run dev` | `bun --watch run vite.ts dev` | Starts dev server at `http://localhost:5173/` with HMR (use `--open` or `-o` to launch browser) |
| `bun run build` | `bun run vite.ts build` | Builds minified, hashed bundle in `dist/` and prints uncompressed + gzip size summary |
| `bun run preview` | `bun run vite.ts preview` | Serves `dist/` locally with immutable asset caching (`--open` supported) |
| `bun run test` | `bun test --parallel` | Runs all 44 automated unit, integration, and E2E tests |
| `bun run check` | `bun run --parallel "check:*"` | Runs typecheck (`tsc`), linter (`biome`), and tests in parallel |
| `bun run format` | `biome format --write .` | Formats all code according to project style guidelines |

---

## ⚙️ Configuration & Customization

### Environment Variables

Create a `.env` file in the root directory (see [`.env.example`](.env.example)):

```bash
# Variables prefixed with VITE_ are exposed to client code and HTML templates
VITE_API_URL=https://api.example.com
VITE_APP_TITLE=My Application

# Optional: Auto-proxy /api requests during development
VITE_PROXY_TARGET=http://localhost:8080
```

Access variables in client TypeScript:
```typescript
console.log(import.meta.env.VITE_API_URL);
console.log(import.meta.env.DEV); // true in dev, false in build
```

Or in [`index.html`](index.html):
```html
<title>%VITE_APP_TITLE%</title>
```

### API Dev Proxy

Configure custom proxy rules directly in [`vite.ts`](vite.ts) under `CONFIG.proxy` or via `.env`:

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

## 🧹 Code Style

- **Indentation:** 2 spaces (no tabs), enforced via [`.editorconfig`](.editorconfig) and [`biome.json`](biome.json).
- **Quotes:** Single quotes (`'`) for JavaScript/TypeScript, double quotes (`"`) for HTML/SVG attributes.
- **Linter & Formatter:** [Biome](https://biomejs.dev) handles fast formatting and linting.

---

## 📜 License

MIT
