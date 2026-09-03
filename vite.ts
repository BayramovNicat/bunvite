import { watch } from 'node:fs';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { basename, join } from 'node:path';
import { file as bunFile, type Server, type ServerWebSocket, serve } from 'bun';

export type ProxyTarget =
  | string
  | {
      target: string;
      changeOrigin?: boolean;
      rewrite?: (path: string) => string;
    };

export type ProxyConfig = Record<string, ProxyTarget>;

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

    const showOverlay = (message) => {
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
      header.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:#ef4444"></span><span style="font-family:ui-monospace,monospace;font-size:12px;font-weight:600;color:#f43f5e;text-transform:uppercase;letter-spacing:0.05em">BunVite Build Error</span></div><button type="button" style="background:none;border:none;color:#a1a1aa;cursor:pointer;font-size:18px;line-height:1;padding:4px" title="Close (Esc)">&times;</button>';
      header.querySelector("button")?.addEventListener("click", dismissOverlay);

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

    const connect = () => {
      ws = new WebSocket(\`\${proto}//\${location.host}/ws-hmr\`);
      ws.onmessage = async (e) => {
        try {
          const payload = JSON.parse(e.data);

          if (payload.type === "build-error") {
            showOverlay(payload.message);
            return;
          }

          dismissOverlay();

          if (payload.type === "css-update") {
            const links = document.querySelectorAll('link[rel="stylesheet"]');
            for (const link of links) {
              const url = new URL(link.href);
              if (url.pathname === payload.path || url.pathname.endsWith(".css")) {
                const newLink = link.cloneNode();
                newLink.href = \`\${url.pathname}?t=\${payload.timestamp}\`;
                newLink.onload = () => link.remove();
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
              await import(\`\${normPath}?t=\${payload.timestamp}\`);

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

let cachedCss: { code: string; timestamp: number } | null = null;
const cachedJs = new Map<string, { code: string; timestamp: number }>();

async function compileTailwind(force = false): Promise<string> {
  if (!force && cachedCss) {
    return cachedCss.code;
  }

  const proc = Bun.spawn(
    ['bun', 'x', '@tailwindcss/cli', '-i', join(CONFIG.srcDir, 'style.css'), '--cwd', CONFIG.root],
    {
      cwd: CONFIG.root,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  const code = await new Response(proc.stdout).text();
  cachedCss = { code, timestamp: Date.now() };
  return code;
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
  if (!file || file.endsWith('.ts') || file.endsWith('.js')) {
    cachedJs.clear();
  }
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

export function createDevServer(
  port = CONFIG.devPort,
  enableLiveReload = true,
  proxy: ProxyConfig = CONFIG.proxy,
): Server<unknown> {
  const activeSockets = new Set<ServerWebSocket<unknown>>();

  compileTailwind();

  if (enableLiveReload) {
    let debounceTimer: Timer | null = null;

    try {
      watch(CONFIG.root, { recursive: true }, (_evt, rawFile) => {
        if (
          !rawFile ||
          rawFile.startsWith('node_modules') ||
          rawFile.startsWith('dist') ||
          rawFile.startsWith('.git')
        ) {
          return;
        }

        invalidateAssetCache(rawFile);

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const timestamp = Date.now();
          const file = rawFile.replace(/^[./]+/, '');

          if (file.endsWith('.html')) {
            for (const socket of activeSockets) {
              try {
                socket.send(JSON.stringify({ type: 'full-reload' }));
              } catch (_) {}
            }
            return;
          }

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

          for (const socket of activeSockets) {
            try {
              if (compileError) {
                socket.send(
                  JSON.stringify({
                    type: 'build-error',
                    message: compileError,
                  }),
                );
                continue;
              }

              if (file.endsWith('.css')) {
                await compileTailwind(true);
                socket.send(
                  JSON.stringify({
                    type: 'css-update',
                    path: '/src/style.css',
                    timestamp,
                  }),
                );
              } else if (
                file.startsWith('src/') &&
                (file.endsWith('.ts') || file.endsWith('.js'))
              ) {
                socket.send(
                  JSON.stringify({
                    type: 'js-update',
                    path: `/${file}`,
                    timestamp,
                  }),
                );
              } else if (file.endsWith('.html')) {
                socket.send(JSON.stringify({ type: 'full-reload' }));
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

      for (const [prefix, config] of Object.entries(proxy)) {
        if (pathname.startsWith(prefix)) {
          const target = typeof config === 'string' ? config : config.target;
          const rewrittenPath =
            typeof config === 'object' && config.rewrite ? config.rewrite(pathname) : pathname;

          const targetUrl = new URL(rewrittenPath + url.search, target);
          const headers = new Headers(req.headers);

          if (typeof config === 'object' && config.changeOrigin) {
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
            return new Response(`Bad Gateway: Proxy error connecting to ${target}\n${msg}`, {
              status: 502,
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
              },
            });
          }
        }
      }

      if (pathname === '/ws-hmr' || pathname === '/ws-reload') {
        if (server.upgrade(req, { data: undefined })) return undefined;
        return new Response('Upgrade failed', { status: 400 });
      }

      if (pathname === '/' || pathname === '/index.html') {
        const html = await renderDevHtml(enableLiveReload);
        return devResponse(req, html, 'text/html; charset=utf-8');
      }

      if (pathname === '/src/style.css' || pathname.endsWith('.css')) {
        const css = await compileTailwind();
        return devResponse(req, css, 'text/css; charset=utf-8');
      }

      if (pathname.endsWith('.ts') || pathname.endsWith('.js')) {
        const filePath = join(CONFIG.root, pathname.replace(/^\//, ''));
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

      const publicFile = bunFile(join(CONFIG.publicDir, pathname.replace(/^\//, '')));
      if (await publicFile.exists()) {
        const bytes = await publicFile.arrayBuffer();
        return devResponse(req, bytes, publicFile.type || 'application/octet-stream');
      }

      const staticFile = bunFile(join(CONFIG.root, pathname.replace(/^\//, '')));
      if (await staticFile.exists()) {
        const bytes = await staticFile.arrayBuffer();
        return devResponse(req, bytes, staticFile.type || 'application/octet-stream');
      }

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

export async function buildProduction() {
  console.log('🚀 Starting production build...\n');
  const start = performance.now();
  const assetsDir = join(CONFIG.distDir, 'assets');

  await rm(CONFIG.distDir, { recursive: true, force: true });
  await mkdir(assetsDir, { recursive: true });

  await cp(CONFIG.publicDir, CONFIG.distDir, { recursive: true }).catch(() => {});

  const jsBuild = await Bun.build({
    entrypoints: [join(CONFIG.srcDir, 'app.ts')],
    outdir: assetsDir,
    naming: 'app.[hash].js',
    target: 'browser',
    minify: true,
    define: getClientEnv('production'),
  });

  if (!jsBuild.success || jsBuild.outputs.length === 0) {
    console.error('❌ JS Build failed:', jsBuild.logs);
    process.exit(1);
  }

  const jsFile = basename(jsBuild.outputs[0].path);
  const cssFile = `style.${Date.now().toString(36)}.css`;
  const cssPath = join(assetsDir, cssFile);

  const twProc = Bun.spawn(
    [
      'bun',
      'x',
      '@tailwindcss/cli',
      '-i',
      join(CONFIG.srcDir, 'style.css'),
      '-o',
      cssPath,
      '--minify',
      '--cwd',
      CONFIG.root,
    ],
    { stdout: 'inherit', stderr: 'inherit', cwd: CONFIG.root },
  );
  await twProc.exited;

  let html = await bunFile(join(CONFIG.root, 'index.html')).text();
  html = replaceEnvInHtml(html);
  const basePrefix = CONFIG.base === '/' ? '/' : CONFIG.base;
  html = html.replace('/src/style.css', `${basePrefix}assets/${cssFile}`);
  html = html.replace('/src/app.ts', `${basePrefix}assets/${jsFile}`);

  await Bun.write(join(CONFIG.distDir, 'index.html'), html);

  const summary = await getBuildSummary(CONFIG.distDir);
  console.log('  dist/ output summary:');
  for (const item of summary) {
    const sizeKb = (item.size / 1024).toFixed(2);
    const gzipKb = (item.gzip / 1024).toFixed(2);
    console.log(
      `  dist/${item.path.padEnd(28)} ${sizeKb.padStart(6)} kB │ gzip: ${gzipKb.padStart(5)} kB`,
    );
  }

  const elapsed = (performance.now() - start).toFixed(1);
  console.log(`\n✨ Production build completed in ${elapsed}ms!\n`);
}

export async function getBuildSummary(
  distDir = CONFIG.distDir,
): Promise<Array<{ path: string; size: number; gzip: number }>> {
  const entries = await readdir(distDir, { recursive: true });
  const results: Array<{ path: string; size: number; gzip: number }> = [];

  for (const entry of entries) {
    const filePath = join(distDir, entry);
    const f = bunFile(filePath);
    if (await f.exists()) {
      const stat = await f.stat();
      if (stat.isFile()) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const gzip = Bun.gzipSync(bytes).byteLength;
        results.push({
          path: entry.replaceAll('\\', '/'),
          size: bytes.byteLength,
          gzip,
        });
      }
    }
  }

  return results.sort((a, b) => b.size - a.size);
}

export function openBrowser(url: string) {
  const osCmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  try {
    Bun.spawn([osCmd, url]).unref();
  } catch (_) {}
}

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.svg',
  '.txt',
  '.xml',
  '.map',
]);

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

        return new Response(file, { headers });
      }
      return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`🔍 Serving production build at http://localhost:${server.port}`);
  return server;
}

const cmd = process.argv[2] || 'dev';

export function getNetworkUrl(port: number): string | null {
  for (const addrs of Object.values(networkInterfaces())) {
    const match = addrs?.find((a) => a.family === 'IPv4' && !a.internal);
    if (match) return `http://${match.address}:${port}/`;
  }
  return null;
}

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
