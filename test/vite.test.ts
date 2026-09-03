import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { file as bunFile, type Server } from 'bun';
import {
  buildProduction,
  CONFIG,
  createDevServer,
  formatBuildError,
  getBuildSummary,
  getClientEnv,
  getNetworkUrl,
  previewProduction,
  replaceEnvInHtml,
  startServerWithFallback,
} from '../vite';

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

  test('compiles TypeScript with HMR state transform', async () => {
    const res = await fetch(`${devBase}/src/app.ts`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    const js = await res.text();
    expect(js).toContain('window.__hmr_state__ ??=');
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
    const badFilePath = join(CONFIG.srcDir, 'temp-syntax-error.ts');
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

      const res = await fetch(`${devBase}/src/temp-syntax-error.ts`);
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
  test('cleans dist, copies public/, and writes hashed assets', async () => {
    await buildProduction();

    const distIndex = bunFile(join(CONFIG.distDir, 'index.html'));
    expect(await distIndex.exists()).toBe(true);
    const html = await distIndex.text();
    expect(html).toMatch(/\/assets\/app\.[a-z0-9]+\.js/);
    expect(html).toMatch(/\/assets\/style\.[a-z0-9]+\.css/);

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

    const cssMatch = html.match(/\/assets\/(style\.[a-z0-9]+\.css)/);
    expect(cssMatch).not.toBeNull();
    const cssContent = await bunFile(join(CONFIG.distDir, 'assets', cssMatch?.[1] ?? '')).text();
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
    const testFile = join(CONFIG.srcDir, 'temp-env-test.ts');
    await Bun.write(
      testFile,
      'export const isDev = import.meta.env.DEV;\nexport const mode = import.meta.env.MODE;',
    );

    try {
      const devServer = createDevServer(0, true);
      try {
        const res = await fetch(`http://localhost:${devServer.port}/src/temp-env-test.ts`);
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
