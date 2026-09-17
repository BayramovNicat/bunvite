import { existsSync, watch } from 'node:fs';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { basename, join } from 'node:path';
import { file as bunFile, type Server, type ServerWebSocket, serve } from 'bun';

// #region 1. Configuration & Types
export const CONFIG = {
  root: import.meta.dir,
  srcDir: join(import.meta.dir, 'src'),
  publicDir: join(import.meta.dir, 'public'),
  distDir: join(import.meta.dir, 'dist'),
  devPort: Number(process.env.PORT) || 5173,
  previewPort: Number(process.env.PORT) || 4173,
  base: (process.env.VITE_BASE || '/').replace(/\/?$/, '/'),
  proxy: (process.env.VITE_PROXY_TARGET
    ? { '/api': process.env.VITE_PROXY_TARGET }
    : {}) as ProxyConfig,
};

const TAILWIND_CACHE_DIR = join(CONFIG.root, '.cache', 'tailwind');
const SASS_CACHE_DIR = join(CONFIG.root, '.cache', 'sass');
const SASS_SHIM_DIR = join(CONFIG.root, '.cache', 'sass-shims');
const MAX_CACHEABLE_ASSET_SIZE = 2 * 1024 * 1024; // 2 MB

const IGNORED_WATCH_PREFIXES = [
  'node_modules',
  'dist',
  '.git',
  '.cache',
  '.vscode',
  '.DS_Store',
  '.idea',
];

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.css',
  '.scss',
  '.sass',
  '.json',
  '.svg',
  '.txt',
  '.xml',
  '.map',
]);

export type ProxyTarget =
  | string
  | {
      target: string;
      changeOrigin?: boolean;
      rewrite?: (path: string) => string;
    };

export type ProxyConfig = Record<string, ProxyTarget>;

export interface EntrypointInfo {
  file: string;
  path: string;
  rel: string;
}

export interface BuildStageTimings {
  setup: number;
  js: number;
  css: number;
  html: number;
  summary: number;
}

export interface BuildProductionResult {
  elapsed: number;
  stages: BuildStageTimings;
  summary: Array<{ path: string; size: number; gzip: number }>;
}

export interface BuildOptions {
  silent?: boolean;
}

interface BuildErrorLike {
  errors?: Array<{
    message?: string;
    position?: {
      file?: string;
      line?: number;
      column?: number;
      lineText?: string;
    };
  }>;
}

interface StaticCacheEntry {
  bytes: Uint8Array;
  etag: string;
  type: string;
}

// In-memory compiler & asset caches
let cachedCss: { code: string; path?: string; timestamp: number } | null = null;
const cachedJs = new Map<string, { code: string; timestamp: number }>();
const staticAssetCache = new Map<string, StaticCacheEntry>();
// #endregion 1. Configuration & Types

// #region 2. HMR Client Runtime & Error Overlay
const HMR_CLIENT_SCRIPT = /*html*/ `
<script>
  (() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    let ws;
    let overlay = null;
    const hmrCallbacks = new Map();

    window.__hmr__ = {
      onUpdate(path, fn) {
        const norm = path.replace(/^[./]+/, "/");
        hmrCallbacks.set(norm, fn);
      }
    };

    const dismissOverlay = () => {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    };

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") dismissOverlay();
    });

    const showOverlay = (message, title = "BunVite Build Error") => {
      dismissOverlay();
      overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box";
      overlay.onclick = (e) => {
        if (e.target === overlay) dismissOverlay();
      };

      const card = document.createElement("div");
      card.style.cssText = "background:#18181b;border:1px solid #ef4444;border-radius:12px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);max-width:800px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden";

      const header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#27272a;border-bottom:1px solid #3f3f46";
      header.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:#ef4444"></span><span style="font-family:ui-monospace,monospace;font-size:12px;font-weight:600;color:#f43f5e;text-transform:uppercase;letter-spacing:0.05em">' + title + '</span></div><div style="display:flex;align-items:center;gap:8px"><button type="button" id="hmr-reload-btn" style="background:#3f3f46;border:none;color:#e4e4e7;border-radius:6px;font-size:12px;padding:4px 10px;cursor:pointer">Reload</button><button type="button" id="hmr-reset-btn" style="background:#4338ca;border:none;color:#fff;border-radius:6px;font-size:12px;padding:4px 10px;cursor:pointer">Reset & Reload</button><button type="button" id="hmr-close-btn" style="background:none;border:none;color:#a1a1aa;cursor:pointer;font-size:18px;line-height:1;padding:4px" title="Close (Esc)">&times;</button></div>';
      
      header.querySelector("#hmr-reload-btn")?.addEventListener("click", () => location.reload());
      header.querySelector("#hmr-reset-btn")?.addEventListener("click", () => {
        delete window.__hmr_state__;
        try { localStorage.removeItem("bunvite_todos"); } catch (_) {}
        location.reload();
      });
      header.querySelector("#hmr-close-btn")?.addEventListener("click", dismissOverlay);

      const body = document.createElement("div");
      body.style.cssText = "padding:20px;overflow-y:auto";

      const pre = document.createElement("pre");
      pre.style.cssText = "margin:0;color:#fca5a5;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word";
      pre.textContent = message;

      body.appendChild(pre);
      card.appendChild(header);
      card.appendChild(body);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    };

    window.addEventListener("error", (e) => {
      const msg = e.error?.stack || e.error?.message || e.message;
      if (msg) showOverlay(msg, "Runtime Error");
    });

    window.addEventListener("unhandledrejection", (e) => {
      const msg = e.reason?.stack || e.reason?.message || String(e.reason);
      if (msg) showOverlay(msg, "Unhandled Promise Rejection");
    });

    const connect = () => {
      ws = new WebSocket(proto + "//" + location.host + "/ws-hmr");
      ws.onmessage = async (e) => {
        try {
          const payload = JSON.parse(e.data);

          if (payload.type === "build-error") {
            showOverlay(payload.message, "BunVite Build Error");
            return;
          }

          dismissOverlay();

          if (payload.type === "css-update") {
            const links = document.querySelectorAll('link[rel="stylesheet"]');
            for (const link of links) {
              const url = new URL(link.href);
              if (
                url.pathname === payload.path ||
                url.pathname.endsWith(".css") ||
                url.pathname.endsWith(".scss") ||
                url.pathname.endsWith(".sass")
              ) {
                const newLink = link.cloneNode();
                newLink.href = url.pathname + "?t=" + payload.timestamp;
                newLink.onload = () => link.remove();
                newLink.onerror = () => link.remove();
                link.parentNode?.insertBefore(newLink, link.nextSibling);
              }
            }
          }

          if (payload.type === "js-update") {
            const normPath = payload.path.replace(/^[./]+/, "/");
            const mountEl = document.getElementById("app");
            const prevInput = mountEl ? mountEl.querySelector("#todo-input") : null;
            const inputState = prevInput ? {
              value: prevInput.value,
              wasFocused: document.activeElement === prevInput,
              start: prevInput.selectionStart,
              end: prevInput.selectionEnd
            } : null;

            try {
              await import(normPath + "?t=" + payload.timestamp);
              dismissOverlay();

              if (inputState && inputState.value) {
                const newInput = mountEl?.querySelector("#todo-input");
                if (newInput) {
                  newInput.value = inputState.value;
                  if (inputState.wasFocused) {
                    newInput.focus();
                    if (inputState.start !== null && inputState.end !== null) {
                      newInput.setSelectionRange(inputState.start, inputState.end);
                    }
                  }
                }
              }
            } catch (err) {
              console.error("[HMR] Error applying module update:", err);
              showOverlay(err?.stack || err?.message || String(err), "HMR Runtime Error");
            }
          }

          if (payload.type === "full-reload") {
            location.reload();
          }
        } catch (err) {
          console.error("[HMR] Failed to process message:", err);
        }
      };
      ws.onclose = () => setTimeout(connect, 1000);
    };
    connect();
  })();
</script>
`;
// #endregion 2. HMR Client Runtime & Error Overlay

// #region 3. Tailwind & Sass CSS Compiler & Caching
export function getTailwindCommand(args: string[]): string[] {
  const globalBin = Bun.which('tailwindcss');
  if (globalBin) {
    return [globalBin, ...args];
  }
  const localCli = join(CONFIG.root, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
  if (existsSync(localCli)) {
    return ['bun', localCli, ...args];
  }
  return ['bun', 'x', '@tailwindcss/cli', ...args];
}

export function getSassCommand(args: string[]): string[] {
  const globalBin = Bun.which('sass');
  if (globalBin) {
    return [globalBin, ...args];
  }
  const localCli = join(CONFIG.root, 'node_modules', 'sass', 'sass.js');
  if (existsSync(localCli)) {
    return ['bun', localCli, ...args];
  }
  const localBin = join(CONFIG.root, 'node_modules', '.bin', 'sass');
  if (existsSync(localBin)) {
    return [localBin, ...args];
  }
  return ['bun', 'x', 'sass', ...args];
}

export function isSassFile(filePath: string): boolean {
  return filePath.endsWith('.scss') || filePath.endsWith('.sass');
}

export interface CompileSassOptions {
  inputPath?: string;
  sourceText?: string;
  outputPath?: string;
  minify?: boolean;
  loadPaths?: string[];
  indented?: boolean;
}

export interface CompileSassResult {
  code: string;
  error?: string;
}

export async function compileSass(
  options: CompileSassOptions = {},
): Promise<CompileSassResult> {
  const inputPath = options.inputPath;
  const isIndented = options.indented ?? (inputPath?.endsWith('.sass') ?? false);
  let sourceText = options.sourceText;

  if (sourceText === undefined && inputPath) {
    const f = bunFile(inputPath);
    if (!(await f.exists())) {
      return { code: '', error: `File not found: ${inputPath}` };
    }
    sourceText = await f.text();
  }

  if (sourceText === undefined) {
    return { code: '', error: 'No input source or path provided for Sass compilation' };
  }

  const cacheKey = Bun.hash(
    `${sourceText}:${inputPath ?? ''}:${options.minify ? 'min' : 'raw'}:${isIndented}`,
  ).toString(36);
  const cachePath = join(SASS_CACHE_DIR, `${cacheKey}.css`);
  const diskCache = bunFile(cachePath);

  if (await diskCache.exists()) {
    const cached = await diskCache.text();
    if (options.outputPath) {
      await Bun.write(options.outputPath, cached);
    }
    return { code: cached };
  }

  const shimFile = join(SASS_SHIM_DIR, '_tailwindcss.scss');
  if (!existsSync(shimFile)) {
    await mkdir(SASS_SHIM_DIR, { recursive: true });
    await Bun.write(shimFile, '@import "tailwindcss";');
  }

  const defaultLoadPaths = [
    SASS_SHIM_DIR,
    CONFIG.root,
    CONFIG.srcDir,
    join(CONFIG.root, 'node_modules'),
  ];
  if (inputPath) {
    const dir = join(inputPath, '..');
    if (!defaultLoadPaths.includes(dir)) {
      defaultLoadPaths.unshift(dir);
    }
  }
  const allLoadPaths = Array.from(new Set([...(options.loadPaths ?? []), ...defaultLoadPaths]));

  const args: string[] = ['--no-source-map', '--no-color'];
  if (options.minify) {
    args.push('--style=compressed');
  }
  if (isIndented) {
    args.push('--indented');
  }
  for (const lp of allLoadPaths) {
    args.push(`--load-path=${lp}`);
  }

  let code = '';
  if (inputPath && existsSync(inputPath)) {
    const cmd = getSassCommand([...args, inputPath]);
    const proc = Bun.spawn(cmd, {
      cwd: CONFIG.root,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) {
      const error = stderr.trim() || `Sass compilation failed with exit code ${exitCode}`;
      return { code: '', error };
    }
    code = stdout;
  } else {
    await mkdir(SASS_CACHE_DIR, { recursive: true });
    const tempInput = join(SASS_CACHE_DIR, `temp-${cacheKey}.${isIndented ? 'sass' : 'scss'}`);
    await Bun.write(tempInput, sourceText);
    try {
      const cmd = getSassCommand([...args, tempInput]);
      const proc = Bun.spawn(cmd, {
        cwd: CONFIG.root,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      if (exitCode !== 0) {
        const error = stderr.trim() || `Sass compilation failed with exit code ${exitCode}`;
        return { code: '', error };
      }
      code = stdout;
    } finally {
      await rm(tempInput, { force: true }).catch(() => {});
    }
  }

  if (options.outputPath) {
    await Bun.write(options.outputPath, code);
  }

  await mkdir(SASS_CACHE_DIR, { recursive: true }).catch(() => {});
  await Bun.write(cachePath, code).catch(() => {});

  return { code };
}

export function hasTailwindImport(cssText: string): boolean {
  const clean = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  return /@import\s+['"]tailwindcss/i.test(clean);
}

async function getTailwindCacheKey(cssText: string, htmlSource?: string): Promise<string> {
  const html =
    htmlSource ?? (await bunFile(join(CONFIG.root, 'index.html')).text().catch(() => ''));
  const entry = await getAppEntrypoint(html);
  const appCode = await bunFile(entry.path).text().catch(() => '');
  return Bun.hash(`${cssText}:${html}:${appCode}`).toString(36);
}

export async function compileTailwindCss(
  options: {
    inputPath?: string;
    minify?: boolean;
    outputPath?: string;
    silent?: boolean;
    htmlSource?: string;
  } = {},
): Promise<string> {
  const styleEntry = await getStyleEntrypoint(options.htmlSource);
  const inputPath = options.inputPath ?? styleEntry.path;
  const cssFile = bunFile(inputPath);
  if (!(await cssFile.exists())) {
    if (options.outputPath) {
      await Bun.write(options.outputPath, '');
    }
    return '';
  }

  const cssText = await cssFile.text();

  if (!hasTailwindImport(cssText)) {
    let output = cssText;
    if (options.minify) {
      output = output
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,])\s*/g, '$1')
        .trim();
    }
    if (options.outputPath) {
      await Bun.write(options.outputPath, output);
    }
    return output;
  }

  const cacheKey = await getTailwindCacheKey(cssText, options.htmlSource);
  const cachePath = join(TAILWIND_CACHE_DIR, `${cacheKey}.${options.minify ? 'min' : 'raw'}.css`);
  const diskCache = bunFile(cachePath);

  if (await diskCache.exists()) {
    const cached = await diskCache.text();
    if (options.outputPath) {
      await Bun.write(options.outputPath, cached);
    }
    return cached;
  }

  const twCmd = getTailwindCommand([
    '-i',
    inputPath,
    ...(options.outputPath ? ['-o', options.outputPath] : []),
    ...(options.minify ? ['--minify'] : []),
    '--cwd',
    CONFIG.root,
  ]);
  if (options.silent) {
    twCmd.push('--silent');
  }

  let code = '';
  if (options.outputPath) {
    const proc = Bun.spawn(twCmd, {
      cwd: CONFIG.root,
      stdout: options.silent ? 'ignore' : 'inherit',
      stderr: options.silent ? 'ignore' : 'inherit',
    });
    await proc.exited;
    code = await bunFile(options.outputPath).text();
  } else {
    const proc = Bun.spawn(twCmd, {
      cwd: CONFIG.root,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    code = await new Response(proc.stdout).text();
  }

  await Bun.write(cachePath, code).catch(() => {});
  return code;
}

export interface CompileStylesheetOptions {
  inputPath?: string;
  minify?: boolean;
  outputPath?: string;
  silent?: boolean;
  htmlSource?: string;
}

export async function compileStylesheet(
  options: CompileStylesheetOptions = {},
): Promise<{ code: string; error?: string }> {
  const styleEntry = await getStyleEntrypoint(options.htmlSource);
  const inputPath = options.inputPath ?? styleEntry.path;
  const isSass = isSassFile(inputPath);

  if (isSass) {
    const sassRes = await compileSass({
      inputPath,
      minify: options.minify,
    });
    if (sassRes.error) {
      return { code: '', error: sassRes.error };
    }

    if (hasTailwindImport(sassRes.code)) {
      const tempPath = join(TAILWIND_CACHE_DIR, `sass-tw-${Bun.hash(sassRes.code).toString(36)}.css`);
      await mkdir(TAILWIND_CACHE_DIR, { recursive: true });
      await Bun.write(tempPath, sassRes.code);
      try {
        const twCode = await compileTailwindCss({
          inputPath: tempPath,
          minify: options.minify,
          outputPath: options.outputPath,
          silent: options.silent,
          htmlSource: options.htmlSource,
        });
        return { code: twCode };
      } finally {
        await rm(tempPath, { force: true }).catch(() => {});
      }
    }

    if (options.outputPath) {
      await Bun.write(options.outputPath, sassRes.code);
    }
    return { code: sassRes.code };
  }

  const twCode = await compileTailwindCss({
    inputPath,
    minify: options.minify,
    outputPath: options.outputPath,
    silent: options.silent,
    htmlSource: options.htmlSource,
  });
  return { code: twCode };
}

async function compileTailwind(force = false, inputPath?: string): Promise<string> {
  if (!force && cachedCss && (!inputPath || cachedCss.path === inputPath)) {
    return cachedCss.code;
  }

  const res = await compileStylesheet({ inputPath, minify: false, silent: true });
  if (res.error) {
    throw new Error(res.error);
  }
  cachedCss = { code: res.code, path: inputPath, timestamp: Date.now() };
  return res.code;
}

export function createSassBunPlugin(mode: 'development' | 'production') {
  return {
    name: 'bunvite-sass-plugin',
    setup(build: {
      onLoad(
        options: { filter: RegExp },
        callback: (args: { path: string }) => Promise<{ contents: string; loader: 'js' | 'css' }>,
      ): void;
    }) {
      build.onLoad({ filter: /\.(scss|sass)$/ }, async (args: { path: string }) => {
        const res = await compileSass({ inputPath: args.path, minify: mode === 'production' });
        if (res.error) {
          throw new Error(res.error);
        }
        if (mode === 'development') {
          const js = `
            (() => {
              const id = ${JSON.stringify(args.path)};
              let el = document.querySelector(\`style[data-vite-sass="\${id}"]\`);
              if (!el) {
                el = document.createElement("style");
                el.setAttribute("data-vite-sass", id);
                document.head.appendChild(el);
              }
              el.textContent = ${JSON.stringify(res.code)};
            })();
          `;
          return { contents: js, loader: 'js' };
        }
        return { contents: res.code, loader: 'css' };
      });
    },
  };
}
// #endregion 3. Tailwind & Sass CSS Compiler & Caching

// #region 4. Entrypoint Discovery
export async function getAppEntrypoint(htmlSource?: string): Promise<EntrypointInfo> {
  const html =
    htmlSource ?? (await bunFile(join(CONFIG.root, 'index.html')).text().catch(() => ''));
  const match = html.match(/<script\b[^>]*?\bsrc=["']([^"']+\.(?:[tj]sx?|mjs))["'][^>]*>/i);
  if (match) {
    const rawSrc = match[1];
    const cleanPath = rawSrc.replace(/^[./]+/, '');
    const absPath = join(CONFIG.root, cleanPath);
    return {
      file: basename(cleanPath),
      path: absPath,
      rel: rawSrc.startsWith('/') ? rawSrc : `/${cleanPath}`,
    };
  }

  const fallback = join(CONFIG.srcDir, 'app.ts');
  return { file: 'app.ts', path: fallback, rel: '/src/app.ts' };
}

export async function getStyleEntrypoint(htmlSource?: string): Promise<EntrypointInfo> {
  const html =
    htmlSource ?? (await bunFile(join(CONFIG.root, 'index.html')).text().catch(() => ''));
  const linkMatches = html.matchAll(
    /<link\b[^>]*?\bhref=["']([^"']+\.(?:css|scss|sass))["'][^>]*>/gi,
  );
  for (const m of linkMatches) {
    if (/rel=["']stylesheet["']/i.test(m[0])) {
      const rawHref = m[1];
      const cleanPath = rawHref.replace(/^[./]+/, '');
      const absPath = join(CONFIG.root, cleanPath);
      return {
        file: basename(cleanPath),
        path: absPath,
        rel: rawHref.startsWith('/') ? rawHref : `/${cleanPath}`,
      };
    }
  }

  for (const ext of ['scss', 'sass', 'css'] as const) {
    const p = join(CONFIG.srcDir, `style.${ext}`);
    if (existsSync(p)) {
      return { file: `style.${ext}`, path: p, rel: `/src/style.${ext}` };
    }
  }

  const fallback = join(CONFIG.srcDir, 'style.css');
  return { file: 'style.css', path: fallback, rel: '/src/style.css' };
}
// #endregion 4. Entrypoint Discovery

// #region 5. Build Error Formatting & Diagnostics
export function formatBuildError(err: unknown): string {
  const e = err as BuildErrorLike;
  if (Array.isArray(e?.errors) && e.errors.length > 0) {
    return e.errors
      .map((item) => {
        const pos = item.position;
        if (pos?.lineText !== undefined) {
          const col = Math.max(1, pos.column ?? 1);
          const pointer = `${' '.repeat(col - 1)}^`;
          const file = pos.file ?? 'unknown';
          return `${file}:${pos.line}:${pos.column}\n\n  ${pos.line} | ${pos.lineText}\n    | ${pointer}\n\n${item.message ?? 'Build error'}`;
        }
        return item.message ?? String(item);
      })
      .join('\n\n---\n\n');
  }
  return err instanceof Error ? err.message : String(err);
}
// #endregion 5. Build Error Formatting & Diagnostics

// #region 6. Environment Variables & HTML Transforms
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getClientEnv(mode: 'development' | 'production'): Record<string, string> {
  const isDev = mode === 'development';
  const fullEnv: Record<string, unknown> = {
    DEV: isDev,
    PROD: !isDev,
    MODE: mode,
    BASE_URL: CONFIG.base,
  };

  const clientEnv: Record<string, string> = {
    'import.meta.env.DEV': String(isDev),
    'import.meta.env.PROD': String(!isDev),
    'import.meta.env.MODE': JSON.stringify(mode),
    'import.meta.env.BASE_URL': JSON.stringify(CONFIG.base),
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('VITE_') && value !== undefined) {
      clientEnv[`import.meta.env.${key}`] = JSON.stringify(value);
      fullEnv[key] = value;
    }
  }

  clientEnv['import.meta.env'] = JSON.stringify(fullEnv);
  return clientEnv;
}

export function replaceEnvInHtml(html: string): string {
  return html.replace(/%([A-Z0-9_]+)%/g, (match, name) => {
    if (name.startsWith('VITE_') && process.env[name] !== undefined) {
      return process.env[name];
    }
    return match;
  });
}

async function renderDevHtml(enableLiveReload: boolean): Promise<string> {
  const indexFile = bunFile(join(CONFIG.root, 'index.html'));
  let html = await indexFile.text();
  html = replaceEnvInHtml(html);
  if (enableLiveReload) {
    html = html.replace('</body>', `${HMR_CLIENT_SCRIPT}</body>`);
  }
  return html;
}
// #endregion 6. Environment Variables & HTML Transforms

// #region 7. HTTP Dev Responses, CORS & Static Asset Caching
export function devResponse(
  req: Request,
  content: string | Uint8Array | ArrayBuffer,
  contentType: string,
  extraHeaders: Record<string, string> = {},
): Response {
  const etag = `"${Bun.hash(content).toString(16)}"`;
  const baseHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    ETag: etag,
    ...extraHeaders,
  };

  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  return new Response(content as BodyInit, {
    headers: {
      'Content-Type': contentType,
      ...baseHeaders,
    },
  });
}

async function serveStaticFile(req: Request, absPath: string): Promise<Response | null> {
  const file = bunFile(absPath);
  if (!(await file.exists())) return null;

  const stat = await file.stat();
  if (!stat.isFile()) return null;

  const cached = staticAssetCache.get(absPath);
  if (cached) {
    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch === cached.etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
          ETag: cached.etag,
        },
      });
    }
    return new Response(cached.bytes as BodyInit, {
      headers: {
        'Content-Type': cached.type,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        ETag: cached.etag,
      },
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const etag = `"${Bun.hash(bytes).toString(16)}"`;
  const type = file.type || 'application/octet-stream';
  if (bytes.byteLength <= MAX_CACHEABLE_ASSET_SIZE) {
    staticAssetCache.set(absPath, { bytes, etag, type });
  }
  return devResponse(req, bytes, type);
}

export function startServerWithFallback(
  options: Parameters<typeof serve>[0],
  maxAttempts = 10,
): Server<unknown> {
  const initialPort =
    typeof options.port === 'string' ? Number.parseInt(options.port, 10) : (options.port ?? 0);
  if (initialPort === 0) return serve(options);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const targetPort = initialPort + attempt;
    try {
      return serve({ ...options, port: targetPort } as Parameters<typeof serve>[0]);
    } catch (err: unknown) {
      const isPortInUse =
        err instanceof Error &&
        (('code' in err && (err as { code: string }).code === 'EADDRINUSE') ||
          err.message.includes('in use'));
      if (!isPortInUse || attempt === maxAttempts - 1) {
        throw err;
      }
    }
  }
  throw new Error(
    `Could not find an available port after ${maxAttempts} attempts starting from ${initialPort}`,
  );
}
// #endregion 7. HTTP Dev Responses, CORS & Static Asset Caching

// #region 8. TypeScript & JavaScript Compilation
async function compileTypeScript(
  filePath: string,
  force = false,
): Promise<{ code: string } | { error: string }> {
  if (!force && cachedJs.has(filePath)) {
    return { code: cachedJs.get(filePath)?.code ?? '' };
  }

  try {
    const build = await Bun.build({
      entrypoints: [filePath],
      target: 'browser',
      sourcemap: 'inline',
      minify: false,
      define: getClientEnv('development'),
      plugins: [createSassBunPlugin('development')],
    });

    if (!build.success || build.outputs.length === 0) {
      const error = build.logs.map((l) => l.message ?? String(l)).join('\n');
      console.error('❌ Build error:', error);
      return { error: error || 'Build failed' };
    }

    let code = await build.outputs[0].text();
    code = code.replace(
      /(?:const|let|var) state = (\{[^;]+\});/,
      'var state = (window.__hmr_state__ ??= $1);',
    );
    cachedJs.set(filePath, { code, timestamp: Date.now() });
    return { code };
  } catch (err: unknown) {
    const error = formatBuildError(err);
    console.error(`❌ Build error:\n${error}`);
    return { error };
  }
}

function invalidateAssetCache(file?: string) {
  cachedCss = null;
  staticAssetCache.clear();
  if (!file || file.endsWith('.ts') || file.endsWith('.js') || isSassFile(file)) {
    cachedJs.clear();
  }
}
// #endregion 8. TypeScript & JavaScript Compilation

// #region 9. Dev Server, File Watcher & Proxy Engine
export function createDevServer(
  port = CONFIG.devPort,
  enableLiveReload = true,
  proxy: ProxyConfig = CONFIG.proxy,
): Server<unknown> {
  const activeSockets = new Set<ServerWebSocket<unknown>>();

  compileTailwind();

  const proxyEntries = Object.entries(proxy).map(([prefix, config]) => {
    const isObj = typeof config === 'object';
    return {
      prefix,
      target: isObj ? config.target : config,
      changeOrigin: isObj ? Boolean(config.changeOrigin) : false,
      rewrite: isObj && config.rewrite ? config.rewrite : undefined,
    };
  });
  const hasProxy = proxyEntries.length > 0;

  if (enableLiveReload) {
    let debounceTimer: Timer | null = null;

    try {
      watch(CONFIG.root, { recursive: true }, (_evt, rawFile) => {
        if (
          !rawFile ||
          IGNORED_WATCH_PREFIXES.some((p) => rawFile.startsWith(p)) ||
          rawFile.endsWith('~') ||
          rawFile.endsWith('.swp') ||
          rawFile.endsWith('.tmp')
        ) {
          return;
        }

        invalidateAssetCache(rawFile);

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const timestamp = Date.now();
          const file = rawFile.replace(/^[./]+/, '');

          let compileError: string | null = null;

          if (file.startsWith('src/') && (file.endsWith('.ts') || file.endsWith('.js'))) {
            const targetPath = join(CONFIG.root, file);
            if (await bunFile(targetPath).exists()) {
              const res = await compileTypeScript(targetPath, true);
              if ('error' in res) {
                compileError = res.error;
              }
            }
          }

          if (isSassFile(file)) {
            const targetPath = join(CONFIG.root, file);
            if (await bunFile(targetPath).exists()) {
              const res = await compileSass({ inputPath: targetPath });
              if (res.error) {
                compileError = res.error;
              }
            }
          }

          const messages: string[] = [];

          if (compileError) {
            messages.push(
              JSON.stringify({
                type: 'build-error',
                message: compileError,
              }),
            );
          } else {
            const isCss = file.endsWith('.css');
            const isSass = isSassFile(file);
            const isJsOrTs =
              file.startsWith('src/') &&
              (file.endsWith('.ts') ||
                file.endsWith('.js') ||
                file.endsWith('.tsx') ||
                file.endsWith('.jsx'));
            const isHtml = file.endsWith('.html');

            const styleEntry = await getStyleEntrypoint();
            const styleFile = bunFile(styleEntry.path);
            const usesTailwind =
              (await styleFile.exists()) && hasTailwindImport(await styleFile.text());

            if (isCss || isSass || (usesTailwind && (isJsOrTs || isHtml))) {
              try {
                await compileTailwind(true, isCss || isSass ? join(CONFIG.root, file) : styleEntry.path);
                messages.push(
                  JSON.stringify({
                    type: 'css-update',
                    path: isCss || isSass ? `/${file}` : styleEntry.rel,
                    timestamp,
                  }),
                );
              } catch (err: unknown) {
                messages.push(
                  JSON.stringify({
                    type: 'build-error',
                    message: err instanceof Error ? err.message : String(err),
                  }),
                );
              }
            }

            if (isJsOrTs) {
              messages.push(
                JSON.stringify({
                  type: 'js-update',
                  path: `/${file}`,
                  timestamp,
                }),
              );
            } else if (isHtml) {
              messages.push(JSON.stringify({ type: 'full-reload' }));
            }
          }

          for (const socket of activeSockets) {
            try {
              for (const msg of messages) {
                socket.send(msg);
              }
            } catch (_) {}
          }
        }, 40);
      });
    } catch (_) {}
  }

  return startServerWithFallback({
    port,
    websocket: {
      open(ws) {
        activeSockets.add(ws);
      },
      close(ws) {
        activeSockets.delete(ws);
      },
      message() {},
    },
    async fetch(req, server) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (req.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
        });
      }

      if (hasProxy) {
        for (const entry of proxyEntries) {
          if (pathname.startsWith(entry.prefix)) {
            const rewrittenPath = entry.rewrite ? entry.rewrite(pathname) : pathname;
            const targetUrl = new URL(rewrittenPath + url.search, entry.target);
            const headers = new Headers(req.headers);

            if (entry.changeOrigin) {
              headers.set('host', targetUrl.host);
            }

            try {
              return await fetch(targetUrl.toString(), {
                method: req.method,
                headers,
                body: req.body,
                // @ts-expect-error Bun supports duplex streaming
                duplex: 'half',
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return new Response(
                `Bad Gateway: Proxy error connecting to ${entry.target}\n${msg}`,
                {
                  status: 502,
                  headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                  },
                },
              );
            }
          }
        }
      }

      if (pathname === '/ws-hmr' || pathname === '/ws-reload') {
        if (server.upgrade(req, { data: undefined })) return undefined;
        return new Response('Upgrade failed', { status: 400 });
      }

      const isHtmlNav =
        req.headers.get('accept')?.includes('text/html') &&
        !pathname.slice(pathname.lastIndexOf('/')).includes('.');

      if (pathname === '/' || pathname === '/index.html' || isHtmlNav) {
        const html = await renderDevHtml(enableLiveReload);
        return devResponse(req, html, 'text/html; charset=utf-8');
      }

      const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;

      if (
        pathname.endsWith('.css') ||
        pathname.endsWith('.scss') ||
        pathname.endsWith('.sass')
      ) {
        let filePath = join(CONFIG.root, cleanPath);
        if (!(await bunFile(filePath).exists()) && pathname.endsWith('.css')) {
          const scssPath = filePath.replace(/\.css$/, '.scss');
          const sassPath = filePath.replace(/\.css$/, '.sass');
          if (await bunFile(scssPath).exists()) {
            filePath = scssPath;
          } else if (await bunFile(sassPath).exists()) {
            filePath = sassPath;
          }
        }

        try {
          const css = await compileTailwind(false, filePath);
          return devResponse(req, css, 'text/css; charset=utf-8');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          for (const socket of activeSockets) {
            try {
              socket.send(JSON.stringify({ type: 'build-error', message }));
            } catch (_) {}
          }
          return new Response(message, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
          });
        }
      }

      if (
        pathname.endsWith('.ts') ||
        pathname.endsWith('.js') ||
        pathname.endsWith('.tsx') ||
        pathname.endsWith('.jsx')
      ) {
        const filePath = join(CONFIG.root, cleanPath);
        const result = await compileTypeScript(filePath);

        if ('error' in result) {
          for (const socket of activeSockets) {
            try {
              socket.send(JSON.stringify({ type: 'build-error', message: result.error }));
            } catch (_) {}
          }
          return new Response(result.error, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
          });
        }

        return devResponse(req, result.code, 'application/javascript; charset=utf-8');
      }

      const publicPath = join(CONFIG.publicDir, cleanPath);
      const publicResponse = await serveStaticFile(req, publicPath);
      if (publicResponse) return publicResponse;

      const rootPath = join(CONFIG.root, cleanPath);
      const rootResponse = await serveStaticFile(req, rootPath);
      if (rootResponse) return rootResponse;

      if (req.headers.get('accept')?.includes('text/html')) {
        const html = await renderDevHtml(enableLiveReload);
        return devResponse(req, html, 'text/html; charset=utf-8');
      }

      return new Response('Not Found', {
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    },
  });
}
// #endregion 9. Dev Server, File Watcher & Proxy Engine

// #region 10. Production Bundler & Build Pipeline
export async function buildProduction(
  options: BuildOptions = {},
): Promise<BuildProductionResult> {
  const silent = options.silent ?? false;
  if (!silent) {
    console.log('🚀 Starting production build...\n');
  }
  const start = performance.now();
  const assetsDir = join(CONFIG.distDir, 'assets');

  const t0 = performance.now();
  const rawHtmlPromise = bunFile(join(CONFIG.root, 'index.html')).text();
  const setupPromise = (async () => {
    await rm(CONFIG.distDir, { recursive: true, force: true });
    await mkdir(assetsDir, { recursive: true });
    await cp(CONFIG.publicDir, CONFIG.distDir, { recursive: true }).catch(() => {});
  })();

  const [rawHtml] = await Promise.all([rawHtmlPromise, setupPromise]);
  const t1 = performance.now();

  const [jsEntry, styleEntry] = await Promise.all([
    getAppEntrypoint(rawHtml),
    getStyleEntrypoint(rawHtml),
  ]);
  const cssBasename = styleEntry.file.replace(/\.(css|scss|sass)$/, '');
  const cssFile = `${cssBasename}.${Date.now().toString(36)}.css`;
  const cssPath = join(assetsDir, cssFile);

  let tJsEnd = 0;
  const tJsStart = performance.now();
  const jsPromise = Bun.build({
    entrypoints: [jsEntry.path],
    outdir: assetsDir,
    naming: '[name].[hash].js',
    target: 'browser',
    minify: true,
    define: getClientEnv('production'),
    plugins: [createSassBunPlugin('production')],
  }).then((res) => {
    tJsEnd = performance.now();
    return res;
  });

  let tCssEnd = 0;
  const tCssStart = performance.now();
  let cssContent = '';

  const cssPromise = (async () => {
    const res = await compileStylesheet({
      inputPath: styleEntry.path,
      minify: true,
      outputPath: cssPath,
      silent,
      htmlSource: rawHtml,
    });
    if (res.error) {
      console.error('❌ CSS/SCSS Build failed:', res.error);
      process.exit(1);
    }
    cssContent = res.code;
    tCssEnd = performance.now();
  })();

  const [jsBuild] = await Promise.all([jsPromise, cssPromise]);

  if (!jsBuild.success || jsBuild.outputs.length === 0) {
    console.error('❌ JS Build failed:', jsBuild.logs);
    process.exit(1);
  }

  const jsFile = basename(jsBuild.outputs[0].path);
  const t3 = performance.now();

  let html = replaceEnvInHtml(rawHtml);
  const basePrefix = CONFIG.base === '/' ? '/' : CONFIG.base;

  const escapedRel = escapeRegExp(styleEntry.rel);
  const styleRegex = new RegExp(
    `<link\\s+[^>]*?href=["'](?:${escapedRel}|\\.?${escapedRel})["'][^>]*\\/?>`,
    'i',
  );
  const replacedStyle = html.replace(styleRegex, `<style>${cssContent}</style>`);
  html =
    replacedStyle !== html
      ? replacedStyle
      : html.replace(
          /<link\s+rel=["']stylesheet["']\s+href=["'][^"']+\.(?:css|scss|sass)["']\s*\/?>/i,
          `<style>${cssContent}</style>`,
        );

  const scriptPattern = escapeRegExp(jsEntry.rel);
  const scriptRegex = new RegExp(scriptPattern, 'g');
  const replacedScript = html.replace(scriptRegex, `${basePrefix}assets/${jsFile}`);
  html =
    replacedScript !== html
      ? replacedScript
      : html.replace(/\/src\/[a-zA-Z0-9_.-]+\.(?:[tj]sx?|mjs)/, `${basePrefix}assets/${jsFile}`);

  html = html.replace(
    '</head>',
    `  <link rel="modulepreload" href="${basePrefix}assets/${jsFile}" />\n  </head>`,
  );

  await Bun.write(join(CONFIG.distDir, 'index.html'), html);
  const t4 = performance.now();

  const summary = await getBuildSummary(CONFIG.distDir);
  const t5 = performance.now();

  if (!silent) {
    console.log('  dist/ output summary:');
    for (const item of summary) {
      const sizeKb = (item.size / 1024).toFixed(2);
      const gzipKb = (item.gzip / 1024).toFixed(2);
      console.log(
        `  dist/${item.path.padEnd(28)} ${sizeKb.padStart(6)} kB │ gzip: ${gzipKb.padStart(5)} kB`,
      );
    }
  }

  const elapsed = t5 - start;
  if (!silent) {
    console.log(`\n✨ Production build completed in ${elapsed.toFixed(1)}ms!\n`);
  }

  return {
    elapsed,
    stages: {
      setup: t1 - t0,
      js: tJsEnd - tJsStart,
      css: tCssEnd - tCssStart,
      html: t4 - t3,
      summary: t5 - t4,
    },
    summary,
  };
}

export async function getBuildSummary(
  distDir = CONFIG.distDir,
): Promise<Array<{ path: string; size: number; gzip: number }>> {
  const entries = await readdir(distDir, { recursive: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const filePath = join(distDir, entry);
        const f = bunFile(filePath);
        const stat = await f.stat();
        if (stat.isFile()) {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const gzip = Bun.gzipSync(bytes).byteLength;
          return {
            path: entry.replaceAll('\\', '/'),
            size: bytes.byteLength,
            gzip,
          };
        }
      } catch (_) {}
      return null;
    }),
  );

  return results
    .filter((item): item is { path: string; size: number; gzip: number } => item !== null)
    .sort((a, b) => b.size - a.size);
}
// #endregion 10. Production Bundler & Build Pipeline

// #region 11. Production Preview Server
function isCompressible(filePath: string): boolean {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex === -1) return false;
  return COMPRESSIBLE_EXTENSIONS.has(filePath.slice(dotIndex).toLowerCase());
}

export function previewProduction(port = CONFIG.previewPort): Server<unknown> {
  const gzipCache = new Map<string, Uint8Array>();

  const server = startServerWithFallback({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      let path = url.pathname;
      if (CONFIG.base !== '/' && path.startsWith(CONFIG.base)) {
        path = path.slice(CONFIG.base.length - 1);
      }
      if (path === '/' || path === '') path = '/index.html';

      const filePath = join(CONFIG.distDir, path);
      const file = bunFile(filePath);
      if (await file.exists()) {
        const headers: Record<string, string> = {};
        if (path.startsWith('/assets/')) {
          headers['Cache-Control'] = 'public, max-age=31536000, immutable';
        }

        const acceptsGzip = req.headers.get('accept-encoding')?.includes('gzip');
        if (acceptsGzip && isCompressible(path)) {
          let gzipped = gzipCache.get(filePath);
          if (!gzipped) {
            const bytes = new Uint8Array(await file.arrayBuffer());
            gzipped = Bun.gzipSync(bytes);
            gzipCache.set(filePath, gzipped);
          }
          headers['Content-Encoding'] = 'gzip';
          headers['Content-Type'] = file.type || 'application/octet-stream';
          headers.Vary = 'Accept-Encoding';
          return new Response(gzipped as BodyInit, { headers });
        }

        return new Response(file as unknown as BodyInit, { headers });
      }
      return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`🔍 Serving production build at http://localhost:${server.port}`);
  return server;
}
// #endregion 11. Production Preview Server

// #region 12. Network Utilities & CLI Runner
export function openBrowser(url: string) {
  const osCmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  try {
    Bun.spawn([osCmd, url]).unref();
  } catch (_) {}
}

export function getNetworkUrl(port: number): string | null {
  for (const addrs of Object.values(networkInterfaces())) {
    const match = addrs?.find((a) => a.family === 'IPv4' && !a.internal);
    if (match) return `http://${match.address}:${port}/`;
  }
  return null;
}

const cmd = process.argv[2] || 'dev';

if (import.meta.main) {
  const isOpen = process.argv.includes('--open') || process.argv.includes('-o');

  if (cmd === 'dev') {
    const server = createDevServer(CONFIG.devPort, true);
    const port = server.port ?? CONFIG.devPort;
    if (port !== CONFIG.devPort) {
      console.log(`\n  ℹ Port ${CONFIG.devPort} is in use, using ${port} instead`);
    }
    const networkUrl = getNetworkUrl(port);
    console.log(`\n  ⚡ BunVite dev server running at:`);
    console.log(`     Local:   http://localhost:${port}/`);
    if (networkUrl) console.log(`     Network: ${networkUrl}`);
    console.log();

    if (isOpen) {
      openBrowser(`http://localhost:${port}/`);
    }
  } else if (cmd === 'build') {
    await buildProduction();
  } else if (cmd === 'preview') {
    const server = previewProduction(CONFIG.previewPort);
    if (isOpen) {
      openBrowser(`http://localhost:${server.port ?? CONFIG.previewPort}/`);
    }
  } else {
    console.log(`Unknown command: "${cmd}". Usage: bun vite.ts [dev|build|preview] [--open]`);
  }
}
// #endregion 12. Network Utilities & CLI Runner
