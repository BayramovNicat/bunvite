import { watch } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { file as bunFile, type Server, type ServerWebSocket, serve } from "bun";

const ROOT_DIR = import.meta.dir;
const DIST_DIR = join(ROOT_DIR, "dist");
const SRC_DIR = join(ROOT_DIR, "src");

const LIVE_RELOAD_SCRIPT = `
<!-- BunVite Live Reload -->
<script>
  (() => {
    let socket;
    function connect() {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(\`\${protocol}//\${location.host}/ws-reload\`);
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "reload") location.reload();
        } catch (_) {}
      };
      socket.onclose = () => setTimeout(connect, 1000);
    }
    connect();
  })();
</script>
`;

/**
 * DEV SERVER (like `vite dev`)
 */
export function createDevServer(
	port = 5173,
	enableLiveReload = true,
): Server<unknown> {
	const sockets = new Set<ServerWebSocket<unknown>>();
	let cachedCss = "";
	let isCompilingCss = false;

	const compileCss = async () => {
		if (isCompilingCss) return;
		isCompilingCss = true;
		try {
			const proc = Bun.spawn(
				["bun", "x", "@tailwindcss/cli", "-i", join(SRC_DIR, "style.css")],
				{
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			cachedCss = await new Response(proc.stdout).text();
		} catch (e) {
			console.error("CSS compilation error:", e);
		} finally {
			isCompilingCss = false;
		}
	};

	// Compile CSS initially
	compileCss();

	// Watch for changes and notify browser
	if (enableLiveReload) {
		let timer: Timer | null = null;
		const notify = async (_event: string, filename: string | null) => {
			if (filename?.endsWith(".css")) {
				await compileCss();
			}
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				for (const ws of sockets) {
					try {
						ws.send(JSON.stringify({ type: "reload" }));
					} catch (_) {}
				}
			}, 50);
		};

		try {
			watch(ROOT_DIR, { recursive: true }, (evt, file) => {
				if (
					file &&
					!file.startsWith("node_modules") &&
					!file.startsWith("dist") &&
					!file.startsWith(".git")
				) {
					notify(evt, file);
				}
			});
		} catch (_) {}
	}

	return serve({
		port,
		websocket: {
			open(ws) {
				sockets.add(ws);
			},
			close(ws) {
				sockets.delete(ws);
			},
			message() {},
		},
		async fetch(req, server) {
			const url = new URL(req.url);

			// 1. Live Reload WebSocket
			if (url.pathname === "/ws-reload") {
				if (server.upgrade(req, { data: undefined })) return undefined;
				return new Response("Upgrade failed", { status: 400 });
			}

			// 2. HTML entrypoint (serves root index.html)
			if (url.pathname === "/" || url.pathname === "/index.html") {
				const indexFile = bunFile(join(ROOT_DIR, "index.html"));
				let html = await indexFile.text();
				if (enableLiveReload) {
					html = html.replace("</body>", `${LIVE_RELOAD_SCRIPT}</body>`);
				}
				return new Response(html, {
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			}

			// 3. Dynamic Tailwind CSS on-the-fly compilation
			if (url.pathname === "/src/style.css" || url.pathname.endsWith(".css")) {
				if (!cachedCss) await compileCss();
				return new Response(cachedCss, {
					headers: { "Content-Type": "text/css; charset=utf-8" },
				});
			}

			// 4. On-demand TS / JS bundling via Bun.build
			if (url.pathname.endsWith(".ts") || url.pathname.endsWith(".js")) {
				const filePath = join(ROOT_DIR, url.pathname.replace(/^\//, ""));
				const build = await Bun.build({
					entrypoints: [filePath],
					target: "browser",
					sourcemap: "inline",
				});

				if (build.success && build.outputs.length > 0) {
					const js = await build.outputs[0].text();
					return new Response(js, {
						headers: {
							"Content-Type": "application/javascript; charset=utf-8",
						},
					});
				}
				return new Response("// Compilation error", { status: 500 });
			}

			// 5. Static assets fallback
			const staticFile = bunFile(
				join(ROOT_DIR, url.pathname.replace(/^\//, "")),
			);
			if (await staticFile.exists()) {
				return new Response(staticFile);
			}

			return new Response("Not Found", { status: 404 });
		},
	});
}

/**
 * PRODUCTION BUILD (like `vite build`)
 */
async function buildApp() {
	console.log("🚀 [BunVite] Building for production...\n");
	const startTime = performance.now();

	await mkdir(join(DIST_DIR, "assets"), { recursive: true });

	// 1. Bundle TypeScript to minified JS
	console.log("📦 Bundling TypeScript...");
	const jsBuild = await Bun.build({
		entrypoints: [join(SRC_DIR, "app.ts")],
		outdir: join(DIST_DIR, "assets"),
		naming: "app.[hash].js",
		target: "browser",
		minify: true,
	});

	if (!jsBuild.success) {
		console.error("❌ JS Build failed:", jsBuild.logs);
		process.exit(1);
	}

	const jsFileName = jsBuild.outputs[0].path.split("/").pop();

	// 2. Compile Tailwind CSS to minified CSS
	console.log("🎨 Compiling Tailwind CSS...");
	const cssFileName = `style.${Date.now().toString(36)}.css`;
	const cssPath = join(DIST_DIR, "assets", cssFileName);

	const twProc = Bun.spawn(
		[
			"bun",
			"x",
			"@tailwindcss/cli",
			"-i",
			join(SRC_DIR, "style.css"),
			"-o",
			cssPath,
			"--minify",
		],
		{ stdout: "inherit", stderr: "inherit" },
	);
	await twProc.exited;

	// 3. Process and write index.html with hashed asset URLs
	console.log("📄 Generating production index.html...");
	let html = await bunFile(join(ROOT_DIR, "index.html")).text();
	html = html.replace("/src/style.css", `/assets/${cssFileName}`);
	html = html.replace("/src/app.ts", `/assets/${jsFileName}`);

	await writeFile(join(DIST_DIR, "index.html"), html, "utf-8");

	const duration = (performance.now() - startTime).toFixed(1);
	console.log(`\n✨ [BunVite] Production build completed in ${duration}ms!`);
	console.log(`📂 Output: dist/\n`);
}

/**
 * PREVIEW SERVER (like `vite preview`)
 */
function previewApp(port = 4173) {
	const server = serve({
		port,
		async fetch(req) {
			const url = new URL(req.url);
			let path = url.pathname;
			if (path === "/" || path === "") path = "/index.html";

			const file = bunFile(join(DIST_DIR, path));
			if (await file.exists()) {
				return new Response(file);
			}
			return new Response("Not Found", { status: 404 });
		},
	});

	console.log(
		`🔍 [BunVite Preview] Serving production build at http://localhost:${server.port}`,
	);
}

// CLI Command Router
const command = process.argv[2] || "dev";

if (import.meta.main) {
	if (command === "dev") {
		const port = Number(process.env.PORT) || 5173;
		const server = createDevServer(port, true);
		console.log(`\n  ⚡ BunVite v1.0.0 dev server running at:\n`);
		console.log(`  > Local:    http://localhost:${server.port}/`);
		console.log(`  > Network:  use --host to expose\n`);
	} else if (command === "build") {
		buildApp();
	} else if (command === "preview") {
		const port = Number(process.env.PORT) || 4173;
		previewApp(port);
	} else {
		console.log(
			`Unknown command: ${command}. Usage: bun vite.ts [dev|build|preview]`,
		);
	}
}
