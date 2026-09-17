import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { file as bunFile, type Server } from 'bun';
import {
  buildProduction,
  compileSass,
  compileStylesheet,
  compileTailwindCss,
  CONFIG,
  createDevServer,
  formatBuildError,
  getBuildSummary,
  getClientEnv,
  getNetworkUrl,
  getSassCommand,
  getTailwindCommand,
  hasTailwindImport,
  isSassFile,
  getAppEntrypoint,
  getStyleEntrypoint,
  previewProduction,
  replaceEnvInHtml,
  startServerWithFallback,
} from '../../vite';

describe('dev server', () => {
  let devServer: Server<unknown>;
  let devBase: string;

  beforeAll(() => {
    devServer = createDevServer(0, true);
    devBase = `http://localhost:${devServer.port}`;
  });

  afterAll(() => {
    devServer.stop(true);
  });

  test('injects HMR runtime into HTML', async () => {
    const res = await fetch(`${devBase}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('window.__hmr__');
    expect(html).toContain('ws-hmr');
    expect(html).toContain('</body>');
    expect(html.indexOf('ws-hmr')).toBeLessThan(html.indexOf('</body>'));
  });

  test('serves /index.html with HMR injection', async () => {
    const res = await fetch(`${devBase}/index.html`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('ws-hmr');
    expect(html).toContain('<div id="app"></div>');
  });

  test('compiles and serves Tailwind CSS', async () => {
    const res = await fetch(`${devBase}/src/style.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/css');
    expect(res.headers.get('cache-control')).toContain('no-cache');
    const css = await res.text();
    expect(css.length).toBeGreaterThan(0);
  });

  test('resolves Tailwind command without root .bin directory', () => {
    const cmd = getTailwindCommand(['-i', 'style.css']);
    const globalTw = Bun.which('tailwindcss');
    if (globalTw) {
      expect(cmd[0]).toBe(globalTw);
    } else {
      expect(cmd).toEqual(['bun', 'x', '@tailwindcss/cli', '-i', 'style.css']);
    }
  });

  test('detects presence and absence of Tailwind imports correctly', () => {
    expect(hasTailwindImport('@import "tailwindcss";')).toBe(true);
    expect(hasTailwindImport('@import \'tailwindcss\' source(none);')).toBe(true);
    expect(hasTailwindImport('@import "tailwindcss/utilities";')).toBe(true);
    expect(hasTailwindImport('@tailwind base;')).toBe(false);
    expect(hasTailwindImport('/* @import "tailwindcss"; */\nbody { color: red; }')).toBe(false);
    expect(hasTailwindImport('body { color: red; margin: 0; }')).toBe(false);
  });

  test('skips Tailwind compilation when style file has no Tailwind import', async () => {
    const tempCssPath = join(CONFIG.root, '.cache', 'plain-test.css');
    await Bun.write(tempCssPath, '/* comment */\nbody {\n  color: red;\n  margin: 0;\n}\n');
    try {
      const output = await compileTailwindCss({
        inputPath: tempCssPath,
        minify: true,
      });
      expect(output).toBe('body{color:red;margin:0;}');
    } finally {
      await bunFile(tempCssPath).delete().catch(() => {});
    }
  });

  test('compiles TypeScript with HMR state transform', async () => {
    const res = await fetch(`${devBase}/src/app.ts`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    const js = await res.text();
    expect(js).toContain('window.__hmr_state__ ??=');
  });

  test('resolves app entrypoint and supports JavaScript files', async () => {
    const entry = await getAppEntrypoint();
    expect(entry.file === 'app.ts' || entry.file === 'app.js').toBe(true);

    const tempJsPath = join(CONFIG.root, 'test', 'temp-test.js');
    await Bun.write(tempJsPath, 'const state = { count: 0 };\nexport const getCount = () => state.count;');
    try {
      const res = await fetch(`${devBase}/test/temp-test.js`);
      expect(res.status).toBe(200);
      const js = await res.text();
      expect(js).toContain('window.__hmr_state__ ??=');
      expect(js).toContain('getCount');
    } finally {
      await bunFile(tempJsPath).delete().catch(() => {});
    }
  });

  test('resolves arbitrary script and style entrypoints from HTML', async () => {
    const customHtml = `
      <html>
        <head>
          <link rel="stylesheet" href="/src/custom-theme.css" />
        </head>
        <body>
          <script type="module" src="/src/script.js"></script>
        </body>
      </html>
    `;
    const appEntry = await getAppEntrypoint(customHtml);
    expect(appEntry.file).toBe('script.js');
    expect(appEntry.rel).toBe('/src/script.js');

    const styleEntry = await getStyleEntrypoint(customHtml);
    expect(styleEntry.file).toBe('custom-theme.css');
    expect(styleEntry.rel).toBe('/src/custom-theme.css');
  });

  test('serves static assets from public/', async () => {
    const res = await fetch(`${devBase}/robots.txt`);
    expect(res.status).toBe(200);
    const content = await res.text();
    expect(content).toContain('User-agent: *');
  });

  test('falls back to index.html for SPA routes', async () => {
    const res = await fetch(`${devBase}/dashboard/tasks/42`, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('ws-hmr');
  });

  test('returns 404 for missing non-HTML assets', async () => {
    const res = await fetch(`${devBase}/missing-image.png`, {
      headers: { Accept: 'image/png' },
    });
    expect(res.status).toBe(404);
  });

  test('accepts WebSocket connections at /ws-hmr', async () => {
    const ws = new WebSocket(`ws://localhost:${devServer.port}/ws-hmr`);
    const connected = await new Promise<boolean>((resolve) => {
      ws.onopen = () => {
        ws.close();
        resolve(true);
      };
      ws.onerror = () => resolve(false);
    });
    expect(connected).toBe(true);
  });

  test('broadcasts build error on syntax failure', async () => {
    const badFilePath = join(CONFIG.root, 'test', 'temp-syntax-error.ts');
    const ws = new WebSocket(`ws://localhost:${devServer.port}/ws-hmr`);

    const origError = console.error;
    console.error = () => {};

    try {
      await new Promise<void>((resolve) => {
        ws.onopen = () => resolve();
      });

      const receivedMessagePromise = new Promise<{ type: string; message: string }>((resolve) => {
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(String(e.data));
            if (data.type === 'build-error') resolve(data);
          } catch (_) {}
        };
      });

      await Bun.write(badFilePath, 'const invalid syntax = ;');

      const res = await fetch(`${devBase}/test/temp-syntax-error.ts`);
      expect(res.status).toBe(500);

      const msg = await Promise.race([
        receivedMessagePromise,
        new Promise<{ type: string; message: string }>((r) =>
          setTimeout(() => r({ type: 'timeout', message: '' }), 2000),
        ),
      ]);

      expect(msg.type).toBe('build-error');
      expect(msg.message.length).toBeGreaterThan(0);
    } finally {
      console.error = origError;
      ws.close();
      await Bun.file(badFilePath)
        .delete()
        .catch(() => {});
    }
  });

  test('resolves local network IPv4 address', () => {
    const url = getNetworkUrl(5173);
    if (url !== null) {
      expect(url).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:5173\/$/);
    }
  });

  test('omits HMR client when live reload is disabled', async () => {
    const staticServer = createDevServer(0, false);
    try {
      const res = await fetch(`http://localhost:${staticServer.port}/`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain('ws-hmr');
    } finally {
      staticServer.stop(true);
    }
  });
});

describe('production build & preview', () => {
  const origLog = console.log;

  beforeAll(() => {
    console.log = () => {};
  });

  afterAll(() => {
    console.log = origLog;
  });

  test('cleans dist, copies public/, and writes hashed assets', async () => {
    await buildProduction();

    const distIndex = bunFile(join(CONFIG.distDir, 'index.html'));
    expect(await distIndex.exists()).toBe(true);
    const html = await distIndex.text();
    expect(html).toMatch(/\/assets\/app\.[a-z0-9]+\.js/);
    expect(html).toContain('<style>');
    expect(html).not.toContain('/src/style.css');
    expect(html).toMatch(/<link rel="modulepreload" href="\/assets\/app\.[a-z0-9]+\.js" \/>/);

    const distRobots = bunFile(join(CONFIG.distDir, 'robots.txt'));
    expect(await distRobots.exists()).toBe(true);
  });

  test('minifies production JS and CSS bundles', async () => {
    const distIndex = bunFile(join(CONFIG.distDir, 'index.html'));
    const html = await distIndex.text();

    const jsMatch = html.match(/\/assets\/(app\.[a-z0-9]+\.js)/);
    expect(jsMatch).not.toBeNull();
    const jsContent = await bunFile(join(CONFIG.distDir, 'assets', jsMatch?.[1] ?? '')).text();
    expect(jsContent.length).toBeGreaterThan(0);
    expect(jsContent).not.toContain('/*html*/');

    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleMatch).not.toBeNull();
    const cssContent = styleMatch?.[1] ?? '';
    expect(cssContent.length).toBeGreaterThan(0);
    expect(cssContent.includes('\n\n')).toBe(false);
  });

  test('serves preview with immutable asset caching', async () => {
    const previewServer = previewProduction(0);
    const previewBase = `http://localhost:${previewServer.port}`;

    try {
      const indexRes = await fetch(`${previewBase}/`);
      expect(indexRes.status).toBe(200);
      const html = await indexRes.text();
      expect(html).toContain('<div id="app"></div>');
      expect(indexRes.headers.get('content-encoding')).toBe('gzip');

      const match = html.match(/\/assets\/app\.[a-z0-9]+\.js/);
      expect(match).not.toBeNull();
      const assetPath = match?.[0] ?? '';

      const assetRes = await fetch(`${previewBase}${assetPath}`);
      expect(assetRes.status).toBe(200);
      expect(assetRes.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      expect(assetRes.headers.get('content-encoding')).toBe('gzip');

      const uncompressedRes = await fetch(`${previewBase}${assetPath}`, {
        headers: { 'Accept-Encoding': 'identity' },
      });
      expect(uncompressedRes.headers.get('content-encoding')).toBeNull();

      const robotsRes = await fetch(`${previewBase}/robots.txt`);
      expect(robotsRes.status).toBe(200);
    } finally {
      previewServer.stop(true);
    }
  });

  test('returns 404 for missing preview files', async () => {
    const previewServer = previewProduction(0);
    try {
      const res = await fetch(`http://localhost:${previewServer.port}/missing-file.txt`);
      expect(res.status).toBe(404);
    } finally {
      previewServer.stop(true);
    }
  });

  test('calculates gzip and uncompressed sizes in build summary', async () => {
    const summary = await getBuildSummary(CONFIG.distDir);
    expect(summary.length).toBeGreaterThan(0);
    const indexEntry = summary.find((e) => e.path === 'index.html');
    expect(indexEntry).toBeDefined();
    expect(indexEntry?.size).toBeGreaterThan(0);
    expect(indexEntry?.gzip).toBeGreaterThan(0);
  });
});

describe('error overlay & HMR runtime', () => {
  test('formats multiple compiler errors with codeframes', () => {
    const mockError = {
      errors: [
        {
          message: 'Expected ";" but found "syntax"',
          position: {
            file: 'src/app.ts',
            line: 20,
            column: 15,
            lineText: 'const invalid syntax = ;',
          },
        },
        {
          message: 'The constant "invalid" must be initialized',
          position: {
            file: 'src/app.ts',
            line: 20,
            column: 7,
            lineText: 'const invalid syntax = ;',
          },
        },
      ],
    };

    const formatted = formatBuildError(mockError);
    expect(formatted).toContain('src/app.ts:20:15');
    expect(formatted).toContain('src/app.ts:20:7');
    expect(formatted).toContain('---');
    expect(formatted).toContain('Expected ";" but found "syntax"');
    expect(formatted).toContain('The constant "invalid" must be initialized');
    expect(formatted).toContain('^');
  });

  test('falls back gracefully when error positions are missing', () => {
    const fallback = formatBuildError(new Error('Generic bundler failure'));
    expect(fallback).toBe('Generic bundler failure');

    const nonErrorFallback = formatBuildError('Unexpected string error');
    expect(nonErrorFallback).toBe('Unexpected string error');
  });

  test('includes Escape and backdrop dismissal in overlay', async () => {
    const devServer = createDevServer(0, true);
    try {
      const res = await fetch(`http://localhost:${devServer.port}/`);
      const html = await res.text();
      expect(html).toContain('e.key === "Escape"');
      expect(html).toContain('e.target === overlay');
    } finally {
      devServer.stop(true);
    }
  });

  test('includes stylesheet hot-swap logic', async () => {
    const devServer = createDevServer(0, true);
    try {
      const res = await fetch(`http://localhost:${devServer.port}/`);
      const html = await res.text();
      expect(html).toContain('link.cloneNode()');
      expect(html).toContain('newLink.onload = () => link.remove()');
      expect(html).toContain('payload.timestamp');
    } finally {
      devServer.stop(true);
    }
  });

  test('preserves active input state across module reload', async () => {
    const devServer = createDevServer(0, true);
    try {
      const res = await fetch(`http://localhost:${devServer.port}/`);
      const html = await res.text();
      expect(html).toContain('#todo-input');
      expect(html).toContain('prevInput.selectionStart');
      expect(html).toContain('prevInput.selectionEnd');
      expect(html).toContain('newInput.setSelectionRange');
    } finally {
      devServer.stop(true);
    }
  });
});

describe('environment variables & HTML transforms', () => {
  test('defines development environment flags', () => {
    const env = getClientEnv('development');
    expect(env['import.meta.env.DEV']).toBe('true');
    expect(env['import.meta.env.PROD']).toBe('false');
    expect(env['import.meta.env.MODE']).toBe('"development"');
    expect(env['import.meta.env.BASE_URL']).toBe('"/"');
  });

  test('defines production environment flags', () => {
    const env = getClientEnv('production');
    expect(env['import.meta.env.DEV']).toBe('false');
    expect(env['import.meta.env.PROD']).toBe('true');
    expect(env['import.meta.env.MODE']).toBe('"production"');
  });

  test('exposes VITE_ prefixed environment variables', () => {
    process.env.VITE_TEST_CUSTOM_API = 'https://api.test.dev';
    try {
      const env = getClientEnv('development');
      expect(env['import.meta.env.VITE_TEST_CUSTOM_API']).toBe('"https://api.test.dev"');
      const parsedFull = JSON.parse(env['import.meta.env']);
      expect(parsedFull.VITE_TEST_CUSTOM_API).toBe('https://api.test.dev');
    } finally {
      delete process.env.VITE_TEST_CUSTOM_API;
    }
  });

  test('replaces %VITE_*% tokens in HTML', () => {
    process.env.VITE_TEST_TITLE = 'Custom Test App';
    try {
      const input = '<title>%VITE_TEST_TITLE%</title><span>%UNKNOWN_VAR%</span>';
      const output = replaceEnvInHtml(input);
      expect(output).toBe('<title>Custom Test App</title><span>%UNKNOWN_VAR%</span>');
    } finally {
      delete process.env.VITE_TEST_TITLE;
    }
  });

  test('compiles import.meta.env expressions into client bundles', async () => {
    const testFile = join(CONFIG.root, 'test', 'temp-env-test.ts');
    await Bun.write(
      testFile,
      'export const isDev = import.meta.env.DEV;\nexport const mode = import.meta.env.MODE;',
    );

    try {
      const devServer = createDevServer(0, true);
      try {
        const res = await fetch(`http://localhost:${devServer.port}/test/temp-env-test.ts`);
        expect(res.status).toBe(200);
        const js = await res.text();
        expect(js).toContain('true');
        expect(js).toContain('"development"');
      } finally {
        devServer.stop(true);
      }
    } finally {
      await Bun.file(testFile)
        .delete()
        .catch(() => {});
    }
  });
});

describe('port collision handling', () => {
  test('increments port when initial port is in use', () => {
    const s1 = startServerWithFallback({ port: 0, fetch: () => new Response('s1') });
    const port = s1.port ?? 0;

    const s2 = startServerWithFallback({ port, fetch: () => new Response('s2') });
    try {
      expect(s2.port).toBe(port + 1);
    } finally {
      s1.stop(true);
      s2.stop(true);
    }
  });

  test('increments repeatedly past multiple occupied ports', () => {
    const s1 = startServerWithFallback({ port: 0, fetch: () => new Response('s1') });
    const port = s1.port ?? 0;
    const s2 = startServerWithFallback({ port, fetch: () => new Response('s2') });
    const s3 = startServerWithFallback({ port, fetch: () => new Response('s3') });

    try {
      expect(s2.port).toBe(port + 1);
      expect(s3.port).toBe(port + 2);
    } finally {
      s1.stop(true);
      s2.stop(true);
      s3.stop(true);
    }
  });
});

describe('api dev proxy', () => {
  test('forwards GET requests and query params to backend', async () => {
    const backend = startServerWithFallback({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === '/api/tasks' && url.searchParams.get('status') === 'active') {
          return Response.json({ count: 5 });
        }
        return new Response('Not found', { status: 404 });
      },
    });

    const devServer = createDevServer(0, false, {
      '/api': `http://localhost:${backend.port}`,
    });

    try {
      const res = await fetch(`http://localhost:${devServer.port}/api/tasks?status=active`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { count: number };
      expect(data.count).toBe(5);
    } finally {
      backend.stop(true);
      devServer.stop(true);
    }
  });

  test('forwards POST requests with body and custom headers', async () => {
    const backend = startServerWithFallback({
      port: 0,
      async fetch(req) {
        const auth = req.headers.get('authorization');
        const body = (await req.json()) as { name: string };
        return Response.json({ receivedAuth: auth, task: body.name }, { status: 201 });
      },
    });

    const devServer = createDevServer(0, false, {
      '/api': `http://localhost:${backend.port}`,
    });

    try {
      const res = await fetch(`http://localhost:${devServer.port}/api/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-secret-token',
        },
        body: JSON.stringify({ name: 'Buy Milk' }),
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as { receivedAuth: string; task: string };
      expect(data.receivedAuth).toBe('Bearer test-secret-token');
      expect(data.task).toBe('Buy Milk');
    } finally {
      backend.stop(true);
      devServer.stop(true);
    }
  });

  test('rewrites request path when rewrite rule is configured', async () => {
    const backend = startServerWithFallback({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === '/v1/users') {
          return Response.json([{ id: 101 }]);
        }
        return new Response('Path not rewritten', { status: 404 });
      },
    });

    const devServer = createDevServer(0, false, {
      '/api': {
        target: `http://localhost:${backend.port}`,
        rewrite: (path) => path.replace(/^\/api/, '/v1'),
      },
    });

    try {
      const res = await fetch(`http://localhost:${devServer.port}/api/users`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as Array<{ id: number }>;
      expect(data[0].id).toBe(101);
    } finally {
      backend.stop(true);
      devServer.stop(true);
    }
  });

  test('returns 502 Bad Gateway when backend is offline', async () => {
    const devServer = createDevServer(0, false, {
      '/api': 'http://localhost:59998',
    });

    try {
      const res = await fetch(`http://localhost:${devServer.port}/api/offline-service`);
      expect(res.status).toBe(502);
      const text = await res.text();
      expect(text).toContain('Bad Gateway');
    } finally {
      devServer.stop(true);
    }
  });
});

describe('cors & etag caching', () => {
  let devServer: Server<unknown>;
  let devBase: string;

  beforeAll(() => {
    devServer = createDevServer(0, false);
    devBase = `http://localhost:${devServer.port}`;
  });

  afterAll(() => {
    devServer.stop(true);
  });

  test('includes CORS headers on GET requests', async () => {
    const res = await fetch(`${devBase}/src/app.ts`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  test('responds to OPTIONS preflight with 204 and CORS headers', async () => {
    const res = await fetch(`${devBase}/src/app.ts`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
  });

  test('attaches ETag and returns 304 Not Modified when cached', async () => {
    const firstRes = await fetch(`${devBase}/src/app.ts`);
    expect(firstRes.status).toBe(200);
    const etag = firstRes.headers.get('etag');
    expect(etag).not.toBeNull();
    expect(firstRes.headers.get('cache-control')).toBe('no-cache');

    const secondRes = await fetch(`${devBase}/src/app.ts`, {
      headers: { 'If-None-Match': etag ?? '' },
    });
    expect(secondRes.status).toBe(304);
    expect((await secondRes.text()).length).toBe(0);
  });

  test('returns 200 when If-None-Match does not match', async () => {
    const res = await fetch(`${devBase}/src/app.ts`, {
      headers: { 'If-None-Match': '"stale-etag-value"' },
    });
    expect(res.status).toBe(200);
    const code = await res.text();
    expect(code.length).toBeGreaterThan(0);
  });
});

describe('scss and sass support', () => {
  let devServer: Server<unknown>;
  let devBase: string;

  beforeAll(() => {
    devServer = createDevServer(0, false);
    devBase = `http://localhost:${devServer.port}`;
  });

  afterAll(() => {
    devServer.stop(true);
  });

  test('resolves Sass command with fallback', () => {
    const cmd = getSassCommand(['--version']);
    const globalSass = Bun.which('sass');
    if (globalSass) {
      expect(cmd[0]).toBe(globalSass);
    } else {
      expect(cmd).toEqual(['bun', 'x', 'sass', '--version']);
    }
  });

  test('identifies scss and sass file extensions', () => {
    expect(isSassFile('style.scss')).toBe(true);
    expect(isSassFile('theme.sass')).toBe(true);
    expect(isSassFile('/path/to/component.scss')).toBe(true);
    expect(isSassFile('style.css')).toBe(false);
    expect(isSassFile('app.ts')).toBe(false);
    expect(isSassFile('index.html')).toBe(false);
  });

  test('compiles SCSS syntax with nesting, variables, and mixins', async () => {
    const tempScssPath = join(CONFIG.root, '.cache', 'nested-test.scss');
    const source = `
      $theme-color: #6366f1;
      @mixin flex-center {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        @include flex-center;
        background-color: $theme-color;
        .title {
          font-weight: 700;
        }
      }
    `;
    await Bun.write(tempScssPath, source);
    try {
      const res = await compileSass({ inputPath: tempScssPath });
      expect(res.error).toBeUndefined();
      expect(res.code).toContain('background-color: #6366f1');
      expect(res.code).toContain('.card .title');
      expect(res.code).toContain('display: flex');
    } finally {
      await bunFile(tempScssPath).delete().catch(() => {});
    }
  });

  test('supports minified output for SCSS', async () => {
    const tempScssPath = join(CONFIG.root, '.cache', 'minify-test.scss');
    const source = `
      $bg: #18181b;
      .panel {
        background: $bg;
        margin: 0;
        padding: 10px;
      }
    `;
    await Bun.write(tempScssPath, source);
    try {
      const res = await compileSass({ inputPath: tempScssPath, minify: true });
      expect(res.error).toBeUndefined();
      expect(res.code).toContain('.panel{');
      expect(res.code).toContain('#18181b');
    } finally {
      await bunFile(tempScssPath).delete().catch(() => {});
    }
  });

  test('handles SCSS compilation errors gracefully', async () => {
    const tempScssPath = join(CONFIG.root, '.cache', 'broken-test.scss');
    await Bun.write(tempScssPath, '$unclosed: ; .broken { color: $non-existent; }');
    try {
      const res = await compileSass({ inputPath: tempScssPath });
      expect(res.error).toBeDefined();
      expect(res.error?.toLowerCase()).toContain('error');
    } finally {
      await bunFile(tempScssPath).delete().catch(() => {});
    }
  });

  test('dev server compiles and serves .scss file with text/css Content-Type', async () => {
    const tempScssPath = join(CONFIG.root, 'test', 'temp-server-test.scss');
    await Bun.write(tempScssPath, '$primary: #10b981;\n.badge { color: $primary; }');
    try {
      const res = await fetch(`${devBase}/test/temp-server-test.scss`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/css');
      const css = await res.text();
      expect(css).toContain('color: #10b981');
    } finally {
      await bunFile(tempScssPath).delete().catch(() => {});
    }
  });

  test('dev server resolves .css request to .scss file if .css is missing', async () => {
    const tempScssPath = join(CONFIG.root, 'test', 'temp-fallback-test.scss');
    await Bun.write(tempScssPath, '$accent: #ec4899;\n.accent-box { border-color: $accent; }');
    try {
      const res = await fetch(`${devBase}/test/temp-fallback-test.css`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/css');
      const css = await res.text();
      expect(css).toContain('border-color: #ec4899');
    } finally {
      await bunFile(tempScssPath).delete().catch(() => {});
    }
  });

  test('dev server returns 500 on SCSS compilation error', async () => {
    const tempScssPath = join(CONFIG.root, 'test', 'temp-invalid-syntax.scss');
    await Bun.write(tempScssPath, '.invalid { color: $undefined_variable; }');
    try {
      const res = await fetch(`${devBase}/test/temp-invalid-syntax.scss`);
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text.toLowerCase()).toContain('error');
    } finally {
      await bunFile(tempScssPath).delete().catch(() => {});
    }
  });

  test('resolves .scss and .sass entrypoints from HTML', async () => {
    const customHtml = `
      <html>
        <head>
          <link rel="stylesheet" href="/src/theme.scss" />
        </head>
        <body>
          <div id="app"></div>
        </body>
      </html>
    `;
    const styleEntry = await getStyleEntrypoint(customHtml);
    expect(styleEntry.file).toBe('theme.scss');
    expect(styleEntry.rel).toBe('/src/theme.scss');
  });

  test('compileStylesheet processes SCSS and minifies properly', async () => {
    const tempScssPath = join(CONFIG.root, '.cache', 'stylesheet-test.scss');
    await Bun.write(tempScssPath, '$header-color: #f59e0b;\nheader { color: $header-color; margin: 0; }');
    try {
      const res = await compileStylesheet({ inputPath: tempScssPath, minify: true });
      expect(res.error).toBeUndefined();
      expect(res.code).toContain('header{color:#f59e0b;margin:0}');
    } finally {
      await bunFile(tempScssPath).delete().catch(() => {});
    }
  });

  test('compiles TypeScript importing .scss module with DOM injection', async () => {
    const tempScssPath = join(CONFIG.root, 'test', 'temp-comp.scss');
    const tempTsPath = join(CONFIG.root, 'test', 'temp-comp.ts');
    await Bun.write(tempScssPath, '$bg: #3b82f6;\n.btn { background: $bg; }');
    await Bun.write(tempTsPath, 'import "./temp-comp.scss";\nexport const ok = true;');
    const origError = console.error;
    try {
      const res = await fetch(`${devBase}/test/temp-comp.ts`);
      expect(res.status).toBe(200);
      const js = await res.text();
      expect(js).toContain('data-vite-sass');
      expect(js).toContain('background: #3b82f6');
    } finally {
      console.error = () => {};
      await bunFile(tempScssPath).delete().catch(() => {});
      await bunFile(tempTsPath).delete().catch(() => {});
      await new Promise((r) => setTimeout(r, 60));
      console.error = origError;
    }
  });

  test('production build compiles and inlines SCSS entrypoint', async () => {
    const origHtml = await bunFile(join(CONFIG.root, 'index.html')).text();
    const scssPath = join(CONFIG.root, 'test', 'custom-test-theme.scss');
    await Bun.write(
      scssPath,
      '$brand: #8b5cf6;\n.brand-card {\n  background: $brand;\n  span {\n    color: #fff;\n  }\n}',
    );
    const testHtml = origHtml.replace(/\/src\/style\.(?:css|scss)/, '/test/custom-test-theme.scss');
    await Bun.write(join(CONFIG.root, 'index.html'), testHtml);

    try {
      const res = await buildProduction({ silent: true });
      expect(res.summary.length).toBeGreaterThan(0);
      const distIndex = bunFile(join(CONFIG.distDir, 'index.html'));
      expect(await distIndex.exists()).toBe(true);
      const builtHtml = await distIndex.text();
      expect(builtHtml).toContain('.brand-card');
      expect(builtHtml).toContain('#8b5cf6');
      expect(builtHtml).toContain('.brand-card span');
    } finally {
      await Bun.write(join(CONFIG.root, 'index.html'), origHtml);
      await bunFile(scssPath).delete().catch(() => {});
      await buildProduction({ silent: true });
    }
  });
});
