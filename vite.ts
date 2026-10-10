import { existsSync, watch } from 'node:fs';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { basename, join } from 'node:path';
import { file as bunFile, type Server, type ServerWebSocket, serve } from 'bun';

process.env.VITE_APP_TITLE ??= 'BunVite';

export const CONFIG = {
  root: import.meta.dir,
  srcDir: join(import.meta.dir, 'src'),
  publicDir: join(import.meta.dir, 'public'),
  distDir: join(import.meta.dir, 'dist'),
  devPort: Number(process.env.PORT) || 5173,
  previewPort: Number(process.env.PORT) || 4173,
  base: (process.env.VITE_BASE || '/').replace(/\/?$/, '/'),
};

const TAILWIND_CACHE_DIR = join(CONFIG.root, '.cache', 'tailwind');

const IGNORED_WATCH_PREFIXES = [
  'node_modules',
  'dist',
  'test',
  '.git',
  '.cache',
  '.vscode',
  '.DS_Store',
  '.idea',
];

const COMPRESSIBLE_EXTS = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.svg',
  '.txt',
  '.xml',
  '.map',
]);


export interface EntrypointInfo {
  file: string;
  path: string;
  rel: string;
}

export interface BuildProductionResult {
  elapsed: number;
  summary: Array<{ path: string; size: number; gzip: number }>;
}

export interface BuildOptions {
  silent?: boolean;
}

let cachedCss: { code: string; path?: string; timestamp: number } | null = null;
const cachedJs = new Map<string, { code: string; timestamp: number }>();

const HMR_CLIENT_SCRIPT = /*html*/ `
<script>
  (() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    let ws;
    let overlay = null;
    const hmrCallbacks = new Map();

    window.__hmr__ = {
      onUpdate(path, fn) {
        hmrCallbacks.set(path.replace(/^[./]+/, "/"), fn);
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
      card.style.cssText = "background:#18181b;border:1px solid #ef4444;border-radius:12px;max-width:800px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden";

      const header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#27272a;border-bottom:1px solid #3f3f46";
      header.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:#ef4444"></span><span style="font-family:ui-monospace,monospace;font-size:12px;font-weight:600;color:#f43f5e;text-transform:uppercase">' + title + '</span></div><div style="display:flex;align-items:center;gap:8px"><button type="button" id="hmr-reload-btn" style="background:#3f3f46;border:none;color:#e4e4e7;border-radius:6px;font-size:12px;padding:4px 10px;cursor:pointer">Reload</button><button type="button" id="hmr-reset-btn" style="background:#4338ca;border:none;color:#fff;border-radius:6px;font-size:12px;padding:4px 10px;cursor:pointer">Reset & Reload</button><button type="button" id="hmr-close-btn" style="background:none;border:none;color:#a1a1aa;cursor:pointer;font-size:18px;line-height:1;padding:4px" title="Close (Esc)">&times;</button></div>';

      header.querySelector("#hmr-reload-btn")?.addEventListener("click", () => location.reload());
      header.querySelector("#hmr-reset-btn")?.addEventListener("click", () => {
        delete window.__hmr_state__;
        location.reload();
      });
      header.querySelector("#hmr-close-btn")?.addEventListener("click", dismissOverlay);

      const body = document.createElement("div");
      body.style.cssText = "padding:20px;overflow-y:auto";

      const pre = document.createElement("pre");
      pre.style.cssText = "margin:0;color:#fca5a5;font-family:ui-monospace,monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word";
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
              if (url.pathname === payload.path || url.pathname.endsWith(".css")) {
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
            try {
              await import(normPath + "?t=" + payload.timestamp);
              dismissOverlay();
            } catch (err) {
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

export function getTailwindCommand(args: string[]): string[] {
  const globalBin = Bun.which('tailwindcss');
  if (globalBin) return [globalBin, ...args];
  const localCli = join(CONFIG.root, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
  return existsSync(localCli) ? ['bun', localCli, ...args] : ['bun', 'x', '@tailwindcss/cli', ...args];
}

export const isScriptFile = (filePath: string): boolean => /\.(?:[tj]sx?|mjs)$/i.test(filePath);

function resolveCandidate(basePath: string, extensions: readonly string[]): string | null {
  for (const ext of extensions) {
    const candidate = `${basePath}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function hasTailwindImport(cssText: string): boolean {
  return /@import\s*['"]tailwindcss/i.test(cssText.replace(/\/\*[\s\S]*?\*\//g, ''));
}

export async function compileTailwindCss(options: {
  inputPath?: string;
  minify?: boolean;
  outputPath?: string;
  silent?: boolean;
  htmlSource?: string;
} = {}): Promise<string> {
  const styleEntry = await getStyleEntrypoint(options.htmlSource);
  const inputPath = options.inputPath ?? styleEntry.path;
  const cssFile = bunFile(inputPath);
  if (!(await cssFile.exists())) {
    if (options.outputPath) await Bun.write(options.outputPath, '');
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
    if (options.outputPath) await Bun.write(options.outputPath, output);
    return output;
  }

  const html = options.htmlSource ?? (await bunFile(join(CONFIG.root, 'index.html')).text().catch(() => ''));
  const entry = await getAppEntrypoint(html);
  const appCode = await bunFile(entry.path).text().catch(() => '');
  const cacheKey = Bun.hash(`${cssText}:${html}:${appCode}`).toString(36);
  const cachePath = join(TAILWIND_CACHE_DIR, `${cacheKey}.${options.minify ? 'min' : 'raw'}.css`);
  const diskCache = bunFile(cachePath);

  if (await diskCache.exists()) {
    const cached = await diskCache.text();
    if (options.outputPath) await Bun.write(options.outputPath, cached);
    return cached;
  }

  const twCmd = getTailwindCommand([
    '-i',
    inputPath,
    ...(options.outputPath ? ['-o', options.outputPath] : []),
    ...(options.minify ? ['--minify'] : []),
    '--cwd',
    CONFIG.root,
    ...(options.silent ? ['--silent'] : []),
  ]);

  const twEnv = {
    ...process.env,
    NODE_PATH: [
      join(CONFIG.root, 'node_modules'),
      join(process.env.HOME || '', '.bun', 'install', 'global', 'node_modules'),
      process.env.NODE_PATH,
    ]
      .filter(Boolean)
      .join(':'),
  };

  let code = '';
  if (options.outputPath) {
    const proc = Bun.spawn(twCmd, {
      cwd: CONFIG.root,
      env: twEnv,
      stdout: options.silent ? 'ignore' : 'inherit',
      stderr: options.silent ? 'ignore' : 'inherit',
    });
    await proc.exited;
    const f = bunFile(options.outputPath);
    code = (await f.exists()) ? await f.text() : '';
  } else {
    const proc = Bun.spawn(twCmd, { cwd: CONFIG.root, env: twEnv, stdout: 'pipe', stderr: 'pipe' });
    code = await new Response(proc.stdout).text();
  }

  await mkdir(TAILWIND_CACHE_DIR, { recursive: true }).catch(() => {});
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
  try {
    const code = await compileTailwindCss(options);
    return { code };
  } catch (err: unknown) {
    return { code: '', error: err instanceof Error ? err.message : String(err) };
  }
}

async function compileTailwind(force = false, inputPath?: string): Promise<string> {
  if (!force && cachedCss && (!inputPath || cachedCss.path === inputPath)) {
    return cachedCss.code;
  }
  const res = await compileStylesheet({ inputPath, minify: false, silent: true });
  if (res.error) throw new Error(res.error);
  cachedCss = { code: res.code, path: inputPath, timestamp: Date.now() };
  return res.code;
}

export async function getAppEntrypoint(htmlSource?: string): Promise<EntrypointInfo> {
  const html = htmlSource ?? (await bunFile(join(CONFIG.root, 'index.html')).text().catch(() => ''));
  const match = html.match(/<script\b[^>]*?\bsrc=["']([^"']+\.(?:[tj]sx?|mjs))["'][^>]*>/i);
  if (match) {
    const rawSrc = match[1];
    const cleanPath = rawSrc.replace(/^[./]+/, '');
    const absPath = join(CONFIG.root, cleanPath);
    if (existsSync(absPath)) {
      return { file: basename(cleanPath), path: absPath, rel: rawSrc.startsWith('/') ? rawSrc : `/${cleanPath}` };
    }
    const candidate = resolveCandidate(absPath.replace(/\.(?:[tj]sx?|mjs)$/, ''), ['.tsx', '.ts', '.jsx', '.js']);
    if (candidate) {
      const ext = candidate.slice(candidate.lastIndexOf('.'));
      return {
        file: basename(candidate),
        path: candidate,
        rel: (rawSrc.startsWith('/') ? rawSrc : `/${cleanPath}`).replace(/\.(?:[tj]sx?|mjs)$/, ext),
      };
    }
    return { file: basename(cleanPath), path: absPath, rel: rawSrc.startsWith('/') ? rawSrc : `/${cleanPath}` };
  }

  const found = resolveCandidate(join(CONFIG.srcDir, 'app'), ['.tsx', '.ts', '.jsx', '.js']);
  if (found) {
    const file = basename(found);
    return { file, path: found, rel: `/src/${file}` };
  }
  return { file: 'app.ts', path: join(CONFIG.srcDir, 'app.ts'), rel: '/src/app.ts' };
}

export async function getStyleEntrypoint(htmlSource?: string): Promise<EntrypointInfo> {
  const html = htmlSource ?? (await bunFile(join(CONFIG.root, 'index.html')).text().catch(() => ''));
  const linkMatches = html.matchAll(/<link\b[^>]*?\bhref=["']([^"']+\.css)["'][^>]*>/gi);
  for (const m of linkMatches) {
    if (/rel=["']stylesheet["']/i.test(m[0])) {
      const rawHref = m[1];
      const cleanPath = rawHref.replace(/^[./]+/, '');
      return {
        file: basename(cleanPath),
        path: join(CONFIG.root, cleanPath),
        rel: rawHref.startsWith('/') ? rawHref : `/${cleanPath}`,
      };
    }
  }

  const fallback = join(CONFIG.srcDir, 'style.css');
  return { file: 'style.css', path: fallback, rel: '/src/style.css' };
}

export function formatBuildError(err: unknown): string {
  const e = err as {
    errors?: Array<{
      message?: string;
      position?: { file?: string; line?: number; column?: number; lineText?: string };
    }>;
  };
  if (Array.isArray(e?.errors) && e.errors.length > 0) {
    return e.errors
      .map((item) => {
        const pos = item.position;
        if (pos?.lineText !== undefined) {
          const col = Math.max(1, pos.column ?? 1);
          return `${pos.file ?? 'unknown'}:${pos.line}:${pos.column}\n\n  ${pos.line} | ${pos.lineText}\n    | ${' '.repeat(col - 1)}^\n\n${item.message ?? 'Build error'}`;
        }
        return item.message ?? String(item);
      })
      .join('\n\n---\n\n');
  }
  return err instanceof Error ? err.message : String(err);
}

export function getClientEnv(mode: 'development' | 'production'): Record<string, string> {
  const isDev = mode === 'development';
  const fullEnv: Record<string, unknown> = { DEV: isDev, PROD: !isDev, MODE: mode, BASE_URL: CONFIG.base };
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
    return name.startsWith('VITE_') && process.env[name] !== undefined ? process.env[name] : match;
  });
}

async function renderDevHtml(enableLiveReload: boolean): Promise<string> {
  let html = replaceEnvInHtml(await bunFile(join(CONFIG.root, 'index.html')).text());
  return enableLiveReload ? html.replace('</body>', `${HMR_CLIENT_SCRIPT}</body>`) : html;
}

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
    headers: { 'Content-Type': contentType, ...baseHeaders },
  });
}

async function serveStaticFile(req: Request, absPath: string): Promise<Response | null> {
  const file = bunFile(absPath);
  if (!(await file.exists())) return null;
  const stat = await file.stat();
  if (!stat.isFile()) return null;
  return devResponse(req, await file.arrayBuffer(), file.type || 'application/octet-stream');
}

export function startServerWithFallback(
  options: Parameters<typeof serve>[0],
  maxAttempts = 10,
): Server<unknown> {
  const initialPort = typeof options.port === 'string' ? Number.parseInt(options.port, 10) : (options.port ?? 0);
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
      if (!isPortInUse || attempt === maxAttempts - 1) throw err;
    }
  }
  throw new Error(`Could not find an available port after ${maxAttempts} attempts starting from ${initialPort}`);
}

async function compileTypeScript(
  filePath: string,
  force = false,
): Promise<{ code: string } | { error: string }> {
  if (!force && cachedJs.has(filePath)) {
    return { code: cachedJs.get(filePath)?.code ?? '' };
  }

  if (!(await bunFile(filePath).exists())) {
    return { error: `File not found: ${filePath}` };
  }

  try {
    const build = await Bun.build({
      entrypoints: [filePath],
      target: 'browser',
      sourcemap: 'inline',
      minify: false,
      define: getClientEnv('development'),
    });

    if (!build.success || build.outputs.length === 0) {
      if (!(await bunFile(filePath).exists())) return { error: `File not found: ${filePath}` };
      const error = build.logs.map((l) => l.message ?? String(l)).join('\n');
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
    if (!(await bunFile(filePath).exists())) return { error: `File not found: ${filePath}` };
    return { error: formatBuildError(err) };
  }
}

export function createDevServer(
  port = CONFIG.devPort,
  enableLiveReload = true,
): Server<unknown> {
  const activeSockets = new Set<ServerWebSocket<unknown>>();
  compileTailwind();

  if (enableLiveReload) {
    let debounceTimer: Timer | null = null;
    try {
      watch(CONFIG.root, { recursive: true }, (_evt, rawFile) => {
        if (
          !rawFile ||
          IGNORED_WATCH_PREFIXES.some((p) => rawFile === p || rawFile.startsWith(`${p}/`)) ||
          basename(rawFile).startsWith('temp-') ||
          basename(rawFile).startsWith('tmp-') ||
          rawFile.endsWith('~') ||
          rawFile.endsWith('.swp') ||
          rawFile.endsWith('.tmp')
        ) {
          return;
        }

        cachedCss = null;
        if (isScriptFile(rawFile)) cachedJs.clear();

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const timestamp = Date.now();
          const file = rawFile.replace(/^[./]+/, '');
          let compileError: string | null = null;

          if (file.startsWith('src/') && isScriptFile(file)) {
            const targetPath = join(CONFIG.root, file);
            if (await bunFile(targetPath).exists()) {
              const res = await compileTypeScript(targetPath, true);
              if ('error' in res && (await bunFile(targetPath).exists())) compileError = res.error;
            }
          }

          const messages: string[] = [];
          if (compileError) {
            messages.push(JSON.stringify({ type: 'build-error', message: compileError }));
          } else {
            const isCss = file.endsWith('.css');
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

            if (isCss || (usesTailwind && (isJsOrTs || isHtml))) {
              try {
                await compileTailwind(true, isCss ? join(CONFIG.root, file) : styleEntry.path);
                messages.push(
                  JSON.stringify({
                    type: 'css-update',
                    path: isCss ? `/${file}` : styleEntry.rel,
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
              messages.push(JSON.stringify({ type: 'js-update', path: `/${file}`, timestamp }));
            } else if (isHtml) {
              messages.push(JSON.stringify({ type: 'full-reload' }));
            }
          }

          for (const socket of activeSockets) {
            try {
              for (const msg of messages) socket.send(msg);
            } catch (_) {}
          }
        }, 40);
      });
    } catch (_) {}
  }

  return startServerWithFallback({
    port,
    websocket: {
      open(ws) { activeSockets.add(ws); },
      close(ws) { activeSockets.delete(ws); },
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



      if (pathname === '/ws-hmr' || pathname === '/ws-reload') {
        if (server.upgrade(req, { data: undefined })) return undefined;
        return new Response('Upgrade failed', { status: 400 });
      }

      const isHtmlNav =
        req.headers.get('accept')?.includes('text/html') &&
        !pathname.slice(pathname.lastIndexOf('/')).includes('.');

      if (pathname === '/' || pathname === '/index.html' || isHtmlNav) {
        return devResponse(req, await renderDevHtml(enableLiveReload), 'text/html; charset=utf-8');
      }

      const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;

      if (pathname.endsWith('.css')) {
        const filePath = join(CONFIG.root, cleanPath);
        try {
          const css = await compileTailwind(false, filePath);
          return devResponse(req, css, 'text/css; charset=utf-8');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          for (const socket of activeSockets) {
            try { socket.send(JSON.stringify({ type: 'build-error', message })); } catch (_) {}
          }
          return new Response(message, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
      }

      let scriptFilePath = isScriptFile(pathname) ? join(CONFIG.root, cleanPath) : null;
      if (!scriptFilePath && pathname.startsWith('/src/')) {
        scriptFilePath = resolveCandidate(join(CONFIG.root, cleanPath), ['.tsx', '.ts', '.jsx', '.js']);
      }

      if (scriptFilePath) {
        if (!existsSync(scriptFilePath)) {
          const baseWithoutExt = scriptFilePath.replace(/\.(?:[tj]sx?|mjs)$/, '');
          const candidate = resolveCandidate(baseWithoutExt, ['.tsx', '.ts', '.jsx', '.js']);
          if (candidate) scriptFilePath = candidate;
        }

        const result = await compileTypeScript(scriptFilePath);
        if ('error' in result) {
          for (const socket of activeSockets) {
            try { socket.send(JSON.stringify({ type: 'build-error', message: result.error })); } catch (_) {}
          }
          return new Response(result.error, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        return devResponse(req, result.code, 'application/javascript; charset=utf-8');
      }

      const publicRes = await serveStaticFile(req, join(CONFIG.publicDir, cleanPath));
      if (publicRes) return publicRes;

      const rootRes = await serveStaticFile(req, join(CONFIG.root, cleanPath));
      if (rootRes) return rootRes;

      if (req.headers.get('accept')?.includes('text/html')) {
        return devResponse(req, await renderDevHtml(enableLiveReload), 'text/html; charset=utf-8');
      }

      return new Response('Not Found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    },
  });
}

export async function buildProduction(options: BuildOptions = {}): Promise<BuildProductionResult> {
  const silent = options.silent ?? false;
  if (!silent) console.log('🚀 Starting production build...\n');
  const start = performance.now();
  const assetsDir = join(CONFIG.distDir, 'assets');

  const rawHtmlPromise = bunFile(join(CONFIG.root, 'index.html')).text();
  const setupPromise = (async () => {
    await rm(CONFIG.distDir, { recursive: true, force: true });
    await mkdir(assetsDir, { recursive: true });
    await cp(CONFIG.publicDir, CONFIG.distDir, { recursive: true }).catch(() => {});
  })();

  const [rawHtml] = await Promise.all([rawHtmlPromise, setupPromise]);
  const [jsEntry, styleEntry] = await Promise.all([
    getAppEntrypoint(rawHtml),
    getStyleEntrypoint(rawHtml),
  ]);
  const cssBasename = styleEntry.file.replace(/\.css$/, '');
  const cssFile = `${cssBasename}.${Date.now().toString(36)}.css`;
  const cssPath = join(assetsDir, cssFile);

  const jsPromise = Bun.build({
    entrypoints: [jsEntry.path],
    outdir: assetsDir,
    naming: '[name].[hash].js',
    target: 'browser',
    minify: true,
    define: getClientEnv('production'),
  });

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
      console.error('❌ CSS Build failed:', res.error);
      process.exit(1);
    }
    cssContent = res.code;
  })();

  const [jsBuild] = await Promise.all([jsPromise, cssPromise]);
  if (!jsBuild.success || jsBuild.outputs.length === 0) {
    console.error('❌ JS Build failed:', jsBuild.logs);
    process.exit(1);
  }

  const jsFile = basename(jsBuild.outputs[0].path);
  let html = replaceEnvInHtml(rawHtml);
  const basePrefix = CONFIG.base === '/' ? '/' : CONFIG.base;
  const escapedRel = styleEntry.rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const styleRegex = new RegExp(`<link\\s+[^>]*?href=["'](?:${escapedRel}|\\.?${escapedRel})["'][^>]*\\/?>`, 'i');
  const replacedStyle = html.replace(styleRegex, `<style>${cssContent}</style>`);
  html =
    replacedStyle !== html
      ? replacedStyle
      : html.replace(
          /<link\s+rel=["']stylesheet["']\s+href=["'][^"']+\.css["']\s*\/?>/i,
          `<style>${cssContent}</style>`,
        );

  const scriptPattern = jsEntry.rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const replacedScript = html.replace(new RegExp(scriptPattern, 'g'), `${basePrefix}assets/${jsFile}`);
  html =
    replacedScript !== html
      ? replacedScript
      : html.replace(/\/src\/[a-zA-Z0-9_.-]+\.(?:[tj]sx?|mjs)/, `${basePrefix}assets/${jsFile}`);

  html = html.replace('</head>', `  <link rel="modulepreload" href="${basePrefix}assets/${jsFile}" />\n  </head>`);
  await Bun.write(join(CONFIG.distDir, 'index.html'), html);

  const summary = await getBuildSummary(CONFIG.distDir);
  const elapsed = performance.now() - start;

  if (!silent) {
    console.log('  dist/ output summary:');
    for (const item of summary) {
      const sizeKb = (item.size / 1024).toFixed(2);
      const gzipKb = (item.gzip / 1024).toFixed(2);
      console.log(`  dist/${item.path.padEnd(28)} ${sizeKb.padStart(6)} kB │ gzip: ${gzipKb.padStart(5)} kB`);
    }
    console.log(`\n✨ Production build completed in ${elapsed.toFixed(1)}ms!\n`);
  }

  return { elapsed, summary };
}

export async function getBuildSummary(
  distDir = CONFIG.distDir,
): Promise<Array<{ path: string; size: number; gzip: number }>> {
  const entries = await readdir(distDir, { recursive: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const f = bunFile(join(distDir, entry));
        const stat = await f.stat();
        if (stat.isFile()) {
          const bytes = new Uint8Array(await f.arrayBuffer());
          return {
            path: entry.replaceAll('\\', '/'),
            size: bytes.byteLength,
            gzip: Bun.gzipSync(bytes).byteLength,
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

        const dotIndex = path.lastIndexOf('.');
        const ext = dotIndex !== -1 ? path.slice(dotIndex).toLowerCase() : '';
        const acceptsGzip = req.headers.get('accept-encoding')?.includes('gzip');

        if (acceptsGzip && COMPRESSIBLE_EXTS.has(ext)) {
          let gzipped = gzipCache.get(filePath);
          if (!gzipped) {
            gzipped = Bun.gzipSync(new Uint8Array(await file.arrayBuffer()));
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
    if (isOpen) openBrowser(`http://localhost:${port}/`);
  } else if (cmd === 'build') {
    await buildProduction();
  } else if (cmd === 'preview') {
    const server = previewProduction(CONFIG.previewPort);
    if (isOpen) openBrowser(`http://localhost:${server.port ?? CONFIG.previewPort}/`);
  } else {
    console.log(`Unknown command: "${cmd}". Usage: bun vite.ts [dev|build|preview] [--open]`);
  }
}
