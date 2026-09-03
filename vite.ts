import { watch } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { basename, join } from "node:path";
import { file as bunFile, type Server, type ServerWebSocket, serve } from "bun";

export const CONFIG = {
  root: import.meta.dir,
  srcDir: join(import.meta.dir, "src"),
  publicDir: join(import.meta.dir, "public"),
  distDir: join(import.meta.dir, "dist"),
  devPort: Number(process.env.PORT) || 5173,
  previewPort: Number(process.env.PORT) || 4173,
} as const;

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
      if (overlay) { overlay.remove(); overlay = null; }
    };

    const showOverlay = (message) => {
      dismissOverlay();
      overlay = document.createElement("div");
      overlay.setAttribute("style", "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:2rem;cursor:pointer");
      overlay.onclick = dismissOverlay;
      const pre = document.createElement("pre");
      pre.setAttribute("style", "color:#ef4444;font-family:ui-monospace,monospace;font-size:14px;max-width:80ch;white-space:pre-wrap;word-break:break-word");
      pre.textContent = message;
      overlay.appendChild(pre);
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
    ["bun", "x", "@tailwindcss/cli", "-i", join(CONFIG.srcDir, "style.css"), "--cwd", CONFIG.root],
    {
      cwd: CONFIG.root,
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const code = await new Response(proc.stdout).text();
  cachedCss = { code, timestamp: Date.now() };
  return code;
}

async function compileTypeScript(
  filePath: string,
  force = false,
): Promise<{ code: string } | { error: string }> {
  if (!force && cachedJs.has(filePath)) {
    return { code: cachedJs.get(filePath)?.code ?? "" };
  }

  try {
    const build = await Bun.build({
      entrypoints: [filePath],
      target: "browser",
      sourcemap: "inline",
      minify: false,
    });

    if (!build.success || build.outputs.length === 0) {
      const error = build.logs.map((l) => l.message ?? String(l)).join("\n");
      console.error("❌ Build error:", error);
      return { error: error || "Build failed" };
    }

    let code = await build.outputs[0].text();
    code = code.replace(
      /(?:const|let|var) state = (\{[^;]+\});/,
      "var state = (window.__hmr_state__ ??= $1);",
    );
    cachedJs.set(filePath, { code, timestamp: Date.now() });
    return { code };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("❌ Build error:", error);
    return { error };
  }
}

function invalidateAssetCache(file?: string) {
  cachedCss = null;
  if (!file || file.endsWith(".ts") || file.endsWith(".js")) {
    cachedJs.clear();
  }
}

export function createDevServer(port = CONFIG.devPort, enableLiveReload = true): Server<unknown> {
  const activeSockets = new Set<ServerWebSocket<unknown>>();

  compileTailwind();

  if (enableLiveReload) {
    let debounceTimer: Timer | null = null;

    try {
      watch(CONFIG.root, { recursive: true }, (_evt, rawFile) => {
        if (
          !rawFile ||
          rawFile.startsWith("node_modules") ||
          rawFile.startsWith("dist") ||
          rawFile.startsWith(".git")
        ) {
          return;
        }

        invalidateAssetCache(rawFile);

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const timestamp = Date.now();
          const file = rawFile.replace(/^[./]+/, "");

          if (file.endsWith(".html")) {
            for (const socket of activeSockets) {
              try {
                socket.send(JSON.stringify({ type: "full-reload" }));
              } catch (_) {}
            }
            return;
          }

          await compileTailwind(true);

          for (const socket of activeSockets) {
            try {
              socket.send(
                JSON.stringify({
                  type: "css-update",
                  path: "/src/style.css",
                  timestamp,
                }),
              );

              if (file.startsWith("src/") && (file.endsWith(".ts") || file.endsWith(".js"))) {
                socket.send(
                  JSON.stringify({
                    type: "js-update",
                    path: `/${file}`,
                    timestamp,
                  }),
                );
              }
            } catch (_) {}
          }
        }, 40);
      });
    } catch (_) {}
  }

  return serve({
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

      if (pathname === "/ws-hmr" || pathname === "/ws-reload") {
        if (server.upgrade(req, { data: undefined })) return undefined;
        return new Response("Upgrade failed", { status: 400 });
      }

      if (pathname === "/" || pathname === "/index.html") {
        const indexFile = bunFile(join(CONFIG.root, "index.html"));
        let html = await indexFile.text();

        if (enableLiveReload) {
          html = html.replace("</body>", `${HMR_CLIENT_SCRIPT}</body>`);
        }

        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }

      if (pathname === "/src/style.css" || pathname.endsWith(".css")) {
        const css = await compileTailwind();
        return new Response(css, {
          headers: {
            "Content-Type": "text/css; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }

      if (pathname.endsWith(".ts") || pathname.endsWith(".js")) {
        const filePath = join(CONFIG.root, pathname.replace(/^\//, ""));
        const result = await compileTypeScript(filePath);

        if ("error" in result) {
          for (const socket of activeSockets) {
            try {
              socket.send(JSON.stringify({ type: "build-error", message: result.error }));
            } catch (_) {}
          }
          return new Response(result.error, { status: 500 });
        }

        return new Response(result.code, {
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }

      const publicFile = bunFile(join(CONFIG.publicDir, pathname.replace(/^\//, "")));
      if (await publicFile.exists()) {
        return new Response(publicFile);
      }

      const staticFile = bunFile(join(CONFIG.root, pathname.replace(/^\//, "")));
      if (await staticFile.exists()) {
        return new Response(staticFile);
      }

      if (req.headers.get("accept")?.includes("text/html")) {
        const indexFile = bunFile(join(CONFIG.root, "index.html"));
        let html = await indexFile.text();
        if (enableLiveReload) {
          html = html.replace("</body>", `${HMR_CLIENT_SCRIPT}</body>`);
        }
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });
}

export async function buildProduction() {
  console.log("🚀 Starting production build...\n");
  const start = performance.now();
  const assetsDir = join(CONFIG.distDir, "assets");

  await rm(CONFIG.distDir, { recursive: true, force: true });
  await mkdir(assetsDir, { recursive: true });

  await cp(CONFIG.publicDir, CONFIG.distDir, { recursive: true }).catch(() => {});

  const jsBuild = await Bun.build({
    entrypoints: [join(CONFIG.srcDir, "app.ts")],
    outdir: assetsDir,
    naming: "app.[hash].js",
    target: "browser",
    minify: true,
  });

  if (!jsBuild.success || jsBuild.outputs.length === 0) {
    console.error("❌ JS Build failed:", jsBuild.logs);
    process.exit(1);
  }

  const jsFile = basename(jsBuild.outputs[0].path);
  const cssFile = `style.${Date.now().toString(36)}.css`;
  const cssPath = join(assetsDir, cssFile);

  const twProc = Bun.spawn(
    [
      "bun",
      "x",
      "@tailwindcss/cli",
      "-i",
      join(CONFIG.srcDir, "style.css"),
      "-o",
      cssPath,
      "--minify",
      "--cwd",
      CONFIG.root,
    ],
    { stdout: "inherit", stderr: "inherit", cwd: CONFIG.root },
  );
  await twProc.exited;

  let html = await bunFile(join(CONFIG.root, "index.html")).text();
  html = html.replace("/src/style.css", `/assets/${cssFile}`);
  html = html.replace("/src/app.ts", `/assets/${jsFile}`);

  await Bun.write(join(CONFIG.distDir, "index.html"), html);

  const elapsed = (performance.now() - start).toFixed(1);
  console.log(`\n✨ Production build completed in ${elapsed}ms!`);
  console.log(`📂 Output: dist/\n`);
}

export function previewProduction(port = CONFIG.previewPort): Server<unknown> {
  const server = serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      let path = url.pathname;
      if (path === "/" || path === "") path = "/index.html";

      const file = bunFile(join(CONFIG.distDir, path));
      if (await file.exists()) {
        const headers: Record<string, string> = {};
        if (path.startsWith("/assets/")) {
          headers["Cache-Control"] = "public, max-age=31536000, immutable";
        }
        return new Response(file, { headers });
      }
      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`🔍 Serving production build at http://localhost:${server.port}`);
  return server;
}

const cmd = process.argv[2] || "dev";

export function getNetworkUrl(port: number): string | null {
  for (const addrs of Object.values(networkInterfaces())) {
    const match = addrs?.find((a) => a.family === "IPv4" && !a.internal);
    if (match) return `http://${match.address}:${port}/`;
  }
  return null;
}

if (import.meta.main) {
  if (cmd === "dev") {
    const server = createDevServer(CONFIG.devPort, true);
    const port = server.port ?? CONFIG.devPort;
    const networkUrl = getNetworkUrl(port);
    console.log(`\n  ⚡ BunVite dev server running at:`);
    console.log(`     Local:   http://localhost:${port}/`);
    if (networkUrl) console.log(`     Network: ${networkUrl}`);
    console.log();
  } else if (cmd === "build") {
    buildProduction();
  } else if (cmd === "preview") {
    previewProduction(CONFIG.previewPort);
  } else {
    console.log(`Unknown command: "${cmd}". Usage: bun vite.ts [dev|build|preview]`);
  }
}
