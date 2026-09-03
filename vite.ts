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

const LIVE_RELOAD_SCRIPT = `
<script>
  (() => {
    let ws;
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(\`\${proto}//\${location.host}/ws-reload\`);
      ws.onmessage = (e) => {
        try {
          if (JSON.parse(e.data).type === "reload") location.reload();
        } catch (_) {}
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

	const proc = Bun.spawn(["bun", "x", "@tailwindcss/cli", "-i", join(CONFIG.srcDir, "style.css")], {
		stdout: "pipe",
		stderr: "pipe",
	});

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
	if (!file || file.endsWith(".css")) cachedCss = null;
	if (!file || file.endsWith(".ts") || file.endsWith(".js")) cachedJs.clear();
}

export function createDevServer(port = CONFIG.devPort, enableLiveReload = true): Server<unknown> {
	const activeSockets = new Set<ServerWebSocket<unknown>>();

	compileTailwind();

	if (enableLiveReload) {
		let debounceTimer: Timer | null = null;

		try {
			watch(CONFIG.root, { recursive: true }, (_evt, file) => {
				if (
					!file ||
					file.startsWith("node_modules") ||
					file.startsWith("dist") ||
					file.startsWith(".git")
				) {
					return;
				}

				invalidateAssetCache(file);

				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					for (const socket of activeSockets) {
						try {
							socket.send(JSON.stringify({ type: "reload" }));
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

			if (pathname === "/ws-reload") {
				if (server.upgrade(req, { data: undefined })) return undefined;
				return new Response("Upgrade failed", { status: 400 });
			}

			if (pathname === "/" || pathname === "/index.html") {
				const indexFile = bunFile(join(CONFIG.root, "index.html"));
				let html = await indexFile.text();

				if (enableLiveReload) {
					html = html.replace("</body>", `${LIVE_RELOAD_SCRIPT}</body>`);
				}

				return new Response(html, {
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			}

			if (pathname === "/src/style.css" || pathname.endsWith(".css")) {
				const css = await compileTailwind();
				return new Response(css, {
					headers: { "Content-Type": "text/css; charset=utf-8" },
				});
			}

			if (pathname.endsWith(".ts") || pathname.endsWith(".js")) {
				const filePath = join(CONFIG.root, pathname.replace(/^\//, ""));
				const js = await compileTypeScript(filePath);

				if (js !== null) {
					return new Response(js, {
						headers: {
							"Content-Type": "application/javascript; charset=utf-8",
						},
					});
				}
				return new Response("// Error compiling module", {
					status: 500,
				});
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
		],
		{ stdout: "inherit", stderr: "inherit" },
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
		console.log(`\n  ⚡ Dev server running at http://localhost:${server.port}/\n`);
	} else if (cmd === "build") {
		buildProduction();
	} else if (cmd === "preview") {
		previewProduction(CONFIG.previewPort);
	} else {
		console.log(`Unknown command: "${cmd}". Usage: bun vite.ts [dev|build|preview]`);
	}
}
