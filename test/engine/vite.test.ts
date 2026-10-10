import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { file as bunFile, type Server } from 'bun';
import {
  buildProduction,
  compileStylesheet,
  compileTailwindCss,
  CONFIG,
  createDevServer,
  formatBuildError,
  getBuildSummary,
  getNetworkUrl,
  getTailwindCommand,
  hasTailwindImport,
  getAppEntrypoint,
  getStyleEntrypoint,
  isScriptFile,
  previewProduction,
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
    expect(hasTailwindImport("@import 'tailwindcss' source(none);")).toBe(true);
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
      await bunFile(tempCssPath)
        .delete()
        .catch(() => {});
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
    expect(entry.file === 'app.tsx' || entry.file === 'app.ts' || entry.file === 'app.js').toBe(
      true,
    );

    const tempJsPath = join(CONFIG.root, 'test', 'temp-test.js');
    await Bun.write(
      tempJsPath,
      'const state = { count: 0 };\nexport const getCount = () => state.count;',
    );
    try {
      const res = await fetch(`${devBase}/test/temp-test.js`);
      expect(res.status).toBe(200);
      const js = await res.text();
      expect(js).toContain('window.__hmr_state__ ??=');
      expect(js).toContain('getCount');
    } finally {
      await bunFile(tempJsPath)
        .delete()
        .catch(() => {});
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

describe('jsx and tsx support', () => {
  let devServer: Server<unknown>;
  let devBase: string;

  beforeAll(() => {
    devServer = createDevServer(0, false);
    devBase = `http://localhost:${devServer.port}`;
  });

  afterAll(() => {
    devServer.stop(true);
  });

  test('identifies script and jsx/tsx file extensions', () => {
    expect(isScriptFile('app.ts')).toBe(true);
    expect(isScriptFile('app.js')).toBe(true);
    expect(isScriptFile('app.tsx')).toBe(true);
    expect(isScriptFile('app.jsx')).toBe(true);
    expect(isScriptFile('module.mjs')).toBe(true);
    expect(isScriptFile('style.css')).toBe(false);
    expect(isScriptFile('style.scss')).toBe(false);
    expect(isScriptFile('index.html')).toBe(false);
  });

  test('resolves .tsx and .jsx script entrypoints from HTML', async () => {
    const tsxHtml = `
      <html>
        <head></head>
        <body>
          <script type="module" src="/src/main.tsx"></script>
        </body>
      </html>
    `;
    const tsxEntry = await getAppEntrypoint(tsxHtml);
    expect(tsxEntry.file).toBe('main.tsx');
    expect(tsxEntry.rel).toBe('/src/main.tsx');

    const jsxHtml = `
      <html>
        <head></head>
        <body>
          <script type="module" src="/src/main.jsx"></script>
        </body>
      </html>
    `;
    const jsxEntry = await getAppEntrypoint(jsxHtml);
    expect(jsxEntry.file).toBe('main.jsx');
    expect(jsxEntry.rel).toBe('/src/main.jsx');
  });
});
