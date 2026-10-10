import { existsSync, watch } from 'node:fs';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { file as bunFile, type BunPlugin, type Server, serve } from 'bun';

export const CONFIG = {
  root: import.meta.dir,
  srcDir: join(import.meta.dir, 'src'),
  publicDir: join(import.meta.dir, 'public'),
  distDir: join(import.meta.dir, 'dist'),
  devPort: Number(process.env.PORT) || 5173,
  previewPort: Number(process.env.PORT) || 4173,
  base: (process.env.VITE_BASE || '/').replace(/\/?$/, '/'),
};

const IGNORED_WATCH_PATTERN = /^(?:node_modules|dist|test|\.git|\.cache)(?:\/|$)|(?:^|[/\\])(?:temp-|tmp-)|\.(?:swp|tmp)$|~$/;
const SCRIPT_EXTS = ['.tsx', '.ts', '.jsx', '.js'] as const;

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

let cachedCss: { code: string; path?: string } | null = null;
const cachedJs = new Map<string, string>();
let cachedTailwindBase: string[] | null = null;

const HMR_CLIENT_SCRIPT = /*html*/ `
<script>
  (() => {
    let ws;
    let overlay = null;
    window.__hmr__ = { onUpdate() {} };

    const dismissOverlay = () => {
      overlay?.remove();
      overlay = null;
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
      overlay.innerHTML = '<div style="background:#18181b;border:1px solid #ef4444;border-radius:12px;max-width:800px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#27272a;border-bottom:1px solid #3f3f46"><div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:9999px;background:#ef4444"></span><span style="font-family:ui-monospace,monospace;font-size:12px;font-weight:600;color:#f43f5e;text-transform:uppercase">' + title + '</span></div><div style="display:flex;gap:8px"><button type="button" id="hmr-reload-btn" onclick="location.reload()" style="background:#3f3f46;border:none;color:#e4e4e7;border-radius:6px;font-size:12px;padding:4px 10px;cursor:pointer">Reload</button><button type="button" id="hmr-reset-btn" onclick="delete window.__hmr_state__;location.reload()" style="background:#4338ca;border:none;color:#fff;border-radius:6px;font-size:12px;padding:4px 10px;cursor:pointer">Reset & Reload</button><button type="button" id="hmr-close-btn" onclick="this.closest(\\'[style*=fixed]\\').remove()" style="background:none;border:none;color:#a1a1aa;cursor:pointer;font-size:18px;line-height:1;padding:4px" title="Close (Esc)">&times;</button></div></div><div style="padding:20px;overflow-y:auto"><pre style="margin:0;color:#fca5a5;font-family:ui-monospace,monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word"></pre></div></div>';
      (overlay.querySelector("pre")).textContent = message;
      document.body.appendChild(overlay);
    };

    window.addEventListener("error", (e) => showOverlay(e.error?.stack || e.error?.message || e.message, "Runtime Error"));
    window.addEventListener("unhandledrejection", (e) => showOverlay(e.reason?.stack || e.reason?.message || String(e.reason), "Unhandled Promise Rejection"));

    const connect = () => {
      ws = new WebSocket((location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host + "/ws-hmr");
      ws.onmessage = async (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === "build-error") return showOverlay(payload.message, "BunVite Build Error");
          dismissOverlay();

          if (payload.type === "css-update") {
            for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
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
            try {
              await import(payload.path.replace(/^[./]+/, "/") + "?t=" + payload.timestamp);
              dismissOverlay();
            } catch (err) {
              showOverlay(err?.stack || err?.message || String(err), "HMR Runtime Error");
            }
          }

          if (payload.type === "full-reload") location.reload();
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
  if (!cachedTailwindBase) {
    const globalBin = Bun.which('tailwindcss');
    const localCli = join(CONFIG.root, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
    cachedTailwindBase = globalBin
      ? [globalBin]
      : existsSync(localCli)
        ? ['bun', localCli]
        : ['bun', 'x', '@tailwindcss/cli'];
  }
  return [...cachedTailwindBase, ...args];
}

export const isScriptFile = (filePath: string): boolean => /\.(?:[tj]sx?|mjs)$/i.test(filePath);

function resolveCandidate(basePath: string, exts: readonly string[] = SCRIPT_EXTS): string | null {
  for (const ext of exts) {
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

  const twCmd = getTailwindCommand([
    '-i',
    inputPath,
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

  const proc = Bun.spawn(twCmd, { cwd: CONFIG.root, env: twEnv, stdout: 'pipe', stderr: 'pipe' });
  const code = await new Response(proc.stdout).text();
  if (options.outputPath) await Bun.write(options.outputPath, code);
  return code;
}

async function compileTailwind(force = false, inputPath?: string): Promise<string> {
  if (!force && cachedCss && (!inputPath || cachedCss.path === inputPath)) {
    return cachedCss.code;
  }
  const code = await compileTailwindCss({ inputPath, minify: false, silent: true });
  cachedCss = { code, path: inputPath };
  return code;
}

function resolveEntry(
  rawSrc: string | null,
  fallbackPath: string,
  candidateExts: readonly string[] = SCRIPT_EXTS,
): EntrypointInfo {
  if (rawSrc) {
    const clean = rawSrc.replace(/^[./]+/, '');
    const abs = join(CONFIG.root, clean);
    const rel = rawSrc.startsWith('/') ? rawSrc : `/${clean}`;
    if (existsSync(abs)) return { file: basename(clean), path: abs, rel };
    const candidate = resolveCandidate(abs.replace(/\.(?:[tj]sx?|mjs)$/, ''), candidateExts);
    if (candidate) {
      const ext = candidate.slice(candidate.lastIndexOf('.'));
      return { file: basename(candidate), path: candidate, rel: rel.replace(/\.(?:[tj]sx?|mjs)$/, ext) };
    }
    return { file: basename(clean), path: abs, rel };
  }
  const target = resolveCandidate(fallbackPath.replace(/\.(?:[tj]sx?|mjs)$/, ''), candidateExts) ?? fallbackPath;
  return { file: basename(target), path: target, rel: `/src/${basename(target)}` };
}

export async function getAppEntrypoint(htmlSource?: string): Promise<EntrypointInfo> {
  const html = htmlSource ?? (await bunFile(join(CONFIG.root, 'index.html')).text().catch(() => ''));
  const match = html.match(/<script\b[^>]*?\bsrc=["']([^"']+\.(?:[tj]sx?|mjs))["'][^>]*>/i);
  return resolveEntry(match?.[1] ?? null, join(CONFIG.srcDir, 'app.ts'));
}

export async function getStyleEntrypoint(htmlSource?: string): Promise<EntrypointInfo> {
  const html = htmlSource ?? (await bunFile(join(CONFIG.root, 'index.html')).text().catch(() => ''));
  const linkMatch = html.match(
    /<link\b[^>]*?\b(?:rel=["']stylesheet["'][^>]*?href=["']([^"']+\.css)["']|href=["']([^"']+\.css)["'][^>]*?rel=["']stylesheet["'])/i,
  );
  const href = linkMatch?.[1] ?? linkMatch?.[2] ?? null;

  if (!href) {
    const appEntry = await getAppEntrypoint(html);
    if (existsSync(appEntry.path)) {
      const scriptCode = await bunFile(appEntry.path).text().catch(() => '');
      const importMatch = scriptCode.match(/(?:^|\n)\s*import\s+['"]([^'"]+\.css)['"]/);
      if (importMatch?.[1]) {
        const resolved = join(dirname(appEntry.path), importMatch[1]);
        if (existsSync(resolved)) {
          return {
            file: basename(resolved),
            path: resolved,
            rel: `/${relative(CONFIG.root, resolved).replace(/\\/g, '/')}`,
          };
        }
      }
    }
  }
  return resolveEntry(href, join(CONFIG.srcDir, 'style.css'));
}

export function formatBuildError(err: unknown): string {
  const list = (
    err as {
      errors?: Array<{
        message?: string;
        position?: { file?: string; line?: number; column?: number; lineText?: string };
      }>;
    }
  )?.errors;

  if (list?.length) {
    return list
      .map((e) => {
        const pos = e.position;
        if (!pos || pos.lineText === undefined) return e.message ?? String(e);
        const col = Math.max(0, (pos.column ?? 1) - 1);
        return `${pos.file ?? 'unknown'}:${pos.line}:${pos.column}\n\n  ${pos.line} | ${pos.lineText}\n    | ${' '.repeat(col)}^\n\n${e.message ?? 'Build error'}`;
      })
      .join('\n\n---\n\n');
  }
  return err instanceof Error ? err.message : String(err);
}

async function renderDevHtml(enableLiveReload: boolean): Promise<string> {
  const html = await bunFile(join(CONFIG.root, 'index.html')).text();
  return enableLiveReload ? html.replace('</body>', `${HMR_CLIENT_SCRIPT}</body>`) : html;
}

export function devResponse(
  req: Request,
  content: string | Uint8Array | ArrayBuffer,
  contentType: string,
  extraHeaders: Record<string, string> = {},
): Response {
  const etag = `"${Bun.hash(content).toString(16)}"`;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache', ETag: etag, ...extraHeaders };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(content as BodyInit, { headers: { 'Content-Type': contentType, ...headers } });
}

async function serveStaticFile(req: Request, absPath: string): Promise<Response | null> {
  const file = bunFile(absPath);
  if (!(await file.stat().catch(() => null))?.isFile()) return null;
  return devResponse(req, await file.bytes(), file.type || 'application/octet-stream');
}

export function startServerWithFallback(
  options: Parameters<typeof serve>[0],
  maxAttempts = 10,
): Server<unknown> {
  const initialPort = Number(options.port) || 0;
  if (initialPort === 0) return serve(options);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return serve({ ...options, port: initialPort + attempt } as Parameters<typeof serve>[0]);
    } catch (err: unknown) {
      const inUse =
        err instanceof Error &&
        (('code' in err && (err as { code: string }).code === 'EADDRINUSE') || err.message.includes('in use'));
      if (!inUse || attempt === maxAttempts - 1) throw err;
    }
  }
  throw new Error(`Could not find an available port after ${maxAttempts} attempts starting from ${initialPort}`);
}

export function createCssPlugin(mode: 'dev' | 'prod'): BunPlugin {
  return {
    name: 'bunvite-css-loader',
    setup(builder) {
      builder.onLoad({ filter: /\.css$/ }, async (args) => {
        if (mode === 'prod') return { contents: '', loader: 'js' };
        const relPath = `/${relative(CONFIG.root, args.path).replace(/\\/g, '/')}`;
        const js = `if (typeof document !== 'undefined') {
  const href = ${JSON.stringify(relPath)};
  if (!document.querySelector('link[href*="' + href + '"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}`;
        return { contents: js, loader: 'js' };
      });
    },
  };
}

async function compileTypeScript(
  filePath: string,
  force = false,
): Promise<{ code: string } | { error: string }> {
  if (!force && cachedJs.has(filePath)) return { code: cachedJs.get(filePath)! };
  if (!existsSync(filePath)) return { error: `File not found: ${filePath}` };

  try {
    const build = await Bun.build({
      entrypoints: [filePath],
      target: 'browser',
      sourcemap: 'inline',
      minify: false,
      plugins: [createCssPlugin('dev')],
    });

    if (!build.success || build.outputs.length === 0) {
      return { error: build.logs.map((l) => l.message ?? String(l)).join('\n') || 'Build failed' };
    }

    const rawCode = await build.outputs[0].text();
    const code = rawCode.replace(
      /^(?:export\s+)?(?:const|let|var)\s+state\s*=\s*(\{[\s\S]*?\});/m,
      'var state = (window.__hmr_state__ ??= $1);',
    );
    cachedJs.set(filePath, code);
    return { code };
  } catch (err: unknown) {
    return { error: existsSync(filePath) ? formatBuildError(err) : `File not found: ${filePath}` };
  }
}

export function createDevServer(
  port = CONFIG.devPort,
  enableLiveReload = true,
): Server<unknown> {
  let server: Server<unknown>;
  const notify = (data: object) => server.publish('hmr', JSON.stringify(data));

  if (enableLiveReload) {
    let debounceTimer: Timer | null = null;
    try {
      watch(CONFIG.root, { recursive: true }, (_evt, rawFile) => {
        if (!rawFile || IGNORED_WATCH_PATTERN.test(rawFile)) return;

        cachedCss = null;
        if (isScriptFile(rawFile)) cachedJs.clear();

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const timestamp = Date.now();
          const file = rawFile.replace(/^[./]+/, '');
          const isCss = file.endsWith('.css');
          const isJsOrTs = file.startsWith('src/') && isScriptFile(file);
          const isHtml = file.endsWith('.html');

          if (isJsOrTs) {
            const targetPath = join(CONFIG.root, file);
            if (await bunFile(targetPath).exists()) {
              const res = await compileTypeScript(targetPath, true);
              if ('error' in res && (await bunFile(targetPath).exists())) {
                notify({ type: 'build-error', message: res.error });
                return;
              }
            }
          }

          const styleEntry = await getStyleEntrypoint();
          const styleFile = bunFile(styleEntry.path);
          const usesTailwind =
            (await styleFile.exists()) && hasTailwindImport(await styleFile.text());

          if (isCss || (usesTailwind && (isJsOrTs || isHtml))) {
            try {
              await compileTailwind(true, isCss ? join(CONFIG.root, file) : styleEntry.path);
              notify({
                type: 'css-update',
                path: isCss ? `/${file}` : styleEntry.rel,
                timestamp,
              });
            } catch (err: unknown) {
              notify({
                type: 'build-error',
                message: err instanceof Error ? err.message : String(err),
              });
            }
          }

          if (isJsOrTs) notify({ type: 'js-update', path: `/${file}`, timestamp });
          else if (isHtml) notify({ type: 'full-reload' });
        }, 40);
      });
    } catch (_) {}
  }

  server = startServerWithFallback({
    port,
    websocket: {
      open(ws) {
        ws.subscribe('hmr');
      },
      message() {},
    },
    async fetch(req) {
      const { pathname } = new URL(req.url);

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

      if (pathname === '/ws-hmr') {
        if (server.upgrade(req, { data: undefined })) return undefined;
        return new Response('Upgrade failed', { status: 400 });
      }

      if (pathname === '/' || pathname === '/index.html') {
        return devResponse(req, await renderDevHtml(enableLiveReload), 'text/html; charset=utf-8');
      }

      const cleanPath = pathname.replace(/^\/+/, '');

      if (pathname.endsWith('.css')) {
        try {
          const css = await compileTailwind(false, join(CONFIG.root, cleanPath));
          return devResponse(req, css, 'text/css; charset=utf-8');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          notify({ type: 'build-error', message });
          return new Response(message, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
      }

      const scriptPath = pathname.startsWith('/src/')
        ? (existsSync(join(CONFIG.root, cleanPath))
            ? join(CONFIG.root, cleanPath)
            : resolveCandidate(join(CONFIG.root, cleanPath).replace(/\.(?:[tj]sx?|mjs)$/, '')))
        : isScriptFile(pathname)
          ? join(CONFIG.root, cleanPath)
          : null;

      if (scriptPath) {
        const result = await compileTypeScript(scriptPath);
        if ('error' in result) {
          notify({ type: 'build-error', message: result.error });
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

  return server;
}

export async function buildProduction(options: BuildOptions = {}): Promise<BuildProductionResult> {
  const silent = options.silent ?? false;
  if (!silent) console.log('🚀 Starting production build...\n');
  const start = performance.now();
  const assetsDir = join(CONFIG.distDir, 'assets');

  const [rawHtml] = await Promise.all([
    bunFile(join(CONFIG.root, 'index.html')).text(),
    rm(CONFIG.distDir, { recursive: true, force: true }),
  ]);
  await Promise.all([
    mkdir(assetsDir, { recursive: true }),
    cp(CONFIG.publicDir, CONFIG.distDir, { recursive: true }).catch(() => {}),
  ]);

  const [jsEntry, styleEntry] = await Promise.all([
    getAppEntrypoint(rawHtml),
    getStyleEntrypoint(rawHtml),
  ]);
  const cssBasename = styleEntry.file.replace(/\.css$/, '');
  const cssPath = join(assetsDir, `${cssBasename}.${Date.now().toString(36)}.css`);

  const jsPromise = Bun.build({
    entrypoints: [jsEntry.path],
    outdir: assetsDir,
    naming: '[name].[hash].js',
    target: 'browser',
    minify: true,
    plugins: [createCssPlugin('prod')],
  });

  let cssContent = '';
  const cssPromise = (async () => {
    try {
      cssContent = await compileTailwindCss({
        inputPath: styleEntry.path,
        minify: true,
        outputPath: cssPath,
        silent,
        htmlSource: rawHtml,
      });
    } catch (err) {
      console.error('❌ CSS Build failed:', err);
      process.exit(1);
    }
  })();

  const [jsBuild] = await Promise.all([jsPromise, cssPromise]);
  if (!jsBuild.success || jsBuild.outputs.length === 0) {
    console.error('❌ JS Build failed:', jsBuild.logs);
    process.exit(1);
  }

  const jsFile = basename(jsBuild.outputs[0].path);
  const hasLinkTag = /<link\b[^>]*?(?:rel=["']stylesheet["']|href=["'][^"']+\.css["'])/i.test(rawHtml);
  const html = (
    hasLinkTag
      ? rawHtml.replace(/<link\b[^>]*?rel=["']stylesheet["'][^>]*\/?>|<link\b[^>]*?href=["'][^"']+\.css["'][^>]*\/?>/i, `<style>${cssContent}</style>`)
      : rawHtml.replace('</head>', `  <style>${cssContent}</style>\n  </head>`)
  )
    .replace(/<script\b[^>]*?src=["'][^"']+["'][^>]*>/i, `<script type="module" src="${CONFIG.base}assets/${jsFile}">`)
    .replace('</head>', `  <link rel="modulepreload" href="${CONFIG.base}assets/${jsFile}" />\n  </head>`);

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
      const f = bunFile(join(distDir, entry));
      if (!(await f.stat().catch(() => null))?.isFile()) return null;
      const bytes = await f.bytes();
      return {
        path: entry.replaceAll('\\', '/'),
        size: bytes.byteLength,
        gzip: Bun.gzipSync(bytes).byteLength,
      };
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
        const headers: Record<string, string> = path.startsWith('/assets/')
          ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
          : {};

        if (req.headers.get('accept-encoding')?.includes('gzip') && /\.(?:html?|js|css|json|svg|txt|xml|map)$/i.test(path)) {
          let gzipped = gzipCache.get(filePath);
          if (!gzipped) {
            gzipped = Bun.gzipSync(await file.bytes());
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

export function getNetworkUrl(port: number): string | null {
  for (const addrs of Object.values(networkInterfaces())) {
    const match = addrs?.find((a) => a.family === 'IPv4' && !a.internal);
    if (match) return `http://${match.address}:${port}/`;
  }
  return null;
}

const cmd = process.argv[2] || 'dev';

if (import.meta.main) {
  if (cmd === 'dev') {
    const server = createDevServer(CONFIG.devPort, true);
    const port = server.port ?? CONFIG.devPort;
    const net = getNetworkUrl(port);
    console.log(`\n  ⚡ BunVite dev server running at:\n     Local:   http://localhost:${port}/${net ? `\n     Network: ${net}` : ''}\n`);
  } else if (cmd === 'build') {
    await buildProduction();
  } else if (cmd === 'preview') {
    previewProduction(CONFIG.previewPort);
  } else {
    console.log(`Unknown command: "${cmd}". Usage: bun vite.ts [dev|build|preview]`);
  }
}
