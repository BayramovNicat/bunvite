import { watch } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { file as bunFile, type Server, type ServerWebSocket, serve } from "bun";

const CONFIG = {
	root: import.meta.dir,
	srcDir: join(import.meta.dir, "src"),
	distDir: join(import.meta.dir, "dist"),
	devPort: Number(process.env.PORT) || 5173,
	previewPort: Number(process.env.PORT) || 4173,
} as const;

const HMR_CLIENT_SCRIPT = `
<script>
  (() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    let ws;
    const hmrCallbacks = new Map();

    window.__hmr__ = {
      onUpdate(path, fn) {
        const norm = path.replace(/^[./]+/, "/");
        hmrCallbacks.set(norm, fn);
      }
    };

    const connect = () => {
      ws = new WebSocket(\`\${proto}//\${location.host}/ws-hmr\`);
      ws.onmessage = async (e) => {
        try {
          const payload = JSON.parse(e.data);

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

            const prevApp = window.app;
            const prevState = prevApp && typeof prevApp.getState === "function" ? prevApp.getState() : null;
            if (prevApp && typeof prevApp.destroy === "function") prevApp.destroy();

            try {
              const newMod = await import(\`\${normPath}?t=\${payload.timestamp}\`);
              if (mountEl && typeof newMod.createApp === "function") {
                window.app = newMod.createApp(mountEl, prevState || undefined);

                if (inputState && inputState.value) {
                  const newInput = mountEl.querySelector("#todo-input");
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

async function compileTypeScript(filePath: string, force = false): Promise<string | null> {
	if (!force && cachedJs.has(filePath)) {
		return cachedJs.get(filePath)?.code ?? null;
	}

	const build = await Bun.build({
		entrypoints: [filePath],
		target: "browser",
		sourcemap: "inline",
		minify: false,
	});

	if (!build.success || build.outputs.length === 0) {
		console.error("❌ Build error:", build.logs);
		return null;
	}

	const code = await build.outputs[0].text();
	cachedJs.set(filePath, { code, timestamp: Date.now() });
	return code;
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

							if (file.endsWith(".ts") || file.endsWith(".js")) {
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
				const js = await compileTypeScript(filePath);

				if (js !== null) {
					return new Response(js, {
						headers: {
							"Content-Type": "application/javascript; charset=utf-8",
							"Cache-Control": "no-cache, no-store, must-revalidate",
						},
					});
				}
				return new Response("Error compiling module", { status: 500 });
			}

			const staticFile = bunFile(join(CONFIG.root, pathname.replace(/^\//, "")));
			if (await staticFile.exists()) {
				return new Response(staticFile);
			}

			return new Response("Not Found", { status: 404 });
		},
	});
}

async function buildProduction() {
	console.log("🚀 Starting production build...\n");
	const start = performance.now();
	const assetsDir = join(CONFIG.distDir, "assets");

	await mkdir(assetsDir, { recursive: true });

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

	await writeFile(join(CONFIG.distDir, "index.html"), html, "utf-8");

	const elapsed = (performance.now() - start).toFixed(1);
	console.log(`\n✨ Production build completed in ${elapsed}ms!`);
	console.log(`📂 Output: dist/\n`);
}

function previewProduction(port = CONFIG.previewPort) {
	const server = serve({
		port,
		async fetch(req) {
			const url = new URL(req.url);
			let path = url.pathname;
			if (path === "/" || path === "") path = "/index.html";

			const file = bunFile(join(CONFIG.distDir, path));
			if (await file.exists()) {
				return new Response(file);
			}
			return new Response("Not Found", { status: 404 });
		},
	});

	console.log(`🔍 Serving production build at http://localhost:${server.port}`);
}

const cmd = process.argv[2] || "dev";

if (import.meta.main) {
	if (cmd === "dev") {
		const server = createDevServer(CONFIG.devPort, true);
		console.log(`\n  ⚡ BunVite HMR dev server running at http://localhost:${server.port}/\n`);
	} else if (cmd === "build") {
		buildProduction();
	} else if (cmd === "preview") {
		previewProduction(CONFIG.previewPort);
	} else {
		console.log(`Unknown command: "${cmd}". Usage: bun vite.ts [dev|build|preview]`);
	}
}
