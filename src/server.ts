import type { Server } from "bun";
import { join } from "path";

const PUBLIC_DIR = join(import.meta.dir, "../public");

export function createAppServer(port = 3000): Server<unknown> {
  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      let path = url.pathname;
      if (path === "/" || path === "") {
        path = "/index.html";
      }

      const filePath = join(PUBLIC_DIR, path);
      const file = Bun.file(filePath);

      if (await file.exists()) {
        return new Response(file);
      }

      return new Response("Not Found", { status: 404 });
    },
  });
}

// Direct execution: bun run src/server.ts
if (import.meta.main) {
  const port = Number(process.env.PORT) || 3000;
  const server = createAppServer(port);
  console.log(`🚀 Todo App server running at http://localhost:${server.port}`);
}
