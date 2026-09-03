import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { file as bunFile, type Server } from 'bun';
import {
  buildProduction,
  CONFIG,
  createDevServer,
  formatBuildError,
  getNetworkUrl,
  previewProduction,
} from '../vite';

describe('BunVite Core Engine & Parity Features 1-by-1 Suite', () => {
  let devServer: Server<unknown>;
  let devBase: string;

  beforeAll(() => {
    devServer = createDevServer(0, true);
    devBase = `http://localhost:${devServer.port}`;
  });

  afterAll(() => {
    devServer.stop(true);
  });

  test('1. HMR client script is injected before </body> in HTML', async () => {
    const res = await fetch(`${devBase}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('window.__hmr__');
    expect(html).toContain('ws-hmr');
    expect(html).toContain('</body>');
    expect(html.indexOf('ws-hmr')).toBeLessThan(html.indexOf('</body>'));
  });

  test('2. Tailwind CSS compiles and serves at /src/style.css with no-cache headers', async () => {
    const res = await fetch(`${devBase}/src/style.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/css');
    expect(res.headers.get('cache-control')).toContain('no-cache');
    const css = await res.text();
    expect(css.length).toBeGreaterThan(0);
  });

  test('3. TypeScript files compile on-the-fly with __hmr_state__ transform', async () => {
    const res = await fetch(`${devBase}/src/app.ts`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    const js = await res.text();
    expect(js).toContain('window.__hmr_state__ ??=');
  });

  test('4. public/ folder serves static assets root-relative', async () => {
    const res = await fetch(`${devBase}/robots.txt`);
    expect(res.status).toBe(200);
    const content = await res.text();
    expect(content).toContain('User-agent: *');
  });

  test('5. SPA fallback serves index.html for unknown paths with Accept: text/html', async () => {
    const res = await fetch(`${devBase}/dashboard/tasks/42`, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('ws-hmr');
  });

  test('6. Non-HTML requests to missing files return 404', async () => {
    const res = await fetch(`${devBase}/missing-image.png`, {
      headers: { Accept: 'image/png' },
    });
    expect(res.status).toBe(404);
  });

  test('7. WebSocket connects cleanly to /ws-hmr', async () => {
    const wsUrl = `ws://localhost:${devServer.port}/ws-hmr`;
    const ws = new WebSocket(wsUrl);

    const connected = await new Promise<boolean>((resolve) => {
      ws.onopen = () => {
        ws.close();
        resolve(true);
      };
      ws.onerror = () => resolve(false);
    });

    expect(connected).toBe(true);
  });

  test('8. TypeScript compilation errors broadcast build-error via WebSocket', async () => {
    const badFilePath = join(CONFIG.srcDir, 'temp-syntax-error.ts');
    const wsUrl = `ws://localhost:${devServer.port}/ws-hmr`;
    const ws = new WebSocket(wsUrl);

    try {
      await new Promise<void>((resolve) => {
        ws.onopen = () => resolve();
      });

      const receivedMessagePromise = new Promise<{ type: string; message: string }>((resolve) => {
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(String(e.data));
            if (data.type === 'build-error') {
              resolve(data);
            }
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
      ws.close();
      await Bun.file(badFilePath)
        .delete()
        .catch(() => {});
    }
  });

  test('9. getNetworkUrl returns valid URL format or null', () => {
    const url = getNetworkUrl(5173);
    if (url !== null) {
      expect(url).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:5173\/$/);
    }
  });

  test('10. production build cleans dist, copies public/, and writes hashed assets', async () => {
    await buildProduction();

    const distIndex = bunFile(join(CONFIG.distDir, 'index.html'));
    expect(await distIndex.exists()).toBe(true);
    const html = await distIndex.text();
    expect(html).toMatch(/\/assets\/app\.[a-z0-9]+\.js/);
    expect(html).toMatch(/\/assets\/style\.[a-z0-9]+\.css/);

    const distRobots = bunFile(join(CONFIG.distDir, 'robots.txt'));
    expect(await distRobots.exists()).toBe(true);
  });

  test('11. preview server serves index.html and applies immutable caching on /assets/*', async () => {
    const previewServer = previewProduction(0);
    const previewBase = `http://localhost:${previewServer.port}`;

    try {
      const indexRes = await fetch(`${previewBase}/`);
      expect(indexRes.status).toBe(200);
      const html = await indexRes.text();
      expect(html).toContain('<div id="app"></div>');

      const match = html.match(/\/assets\/app\.[a-z0-9]+\.js/);
      expect(match).not.toBeNull();
      const assetPath = match?.[0] ?? '';

      const assetRes = await fetch(`${previewBase}${assetPath}`);
      expect(assetRes.status).toBe(200);
      expect(assetRes.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

      const robotsRes = await fetch(`${previewBase}/robots.txt`);
      expect(robotsRes.status).toBe(200);
    } finally {
      previewServer.stop(true);
    }
  });

  test('12. formatBuildError formats multiple errors with distinct codeframes and dividers', () => {
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

  test('13. formatBuildError falls back gracefully when positions are missing', () => {
    const fallback = formatBuildError(new Error('Generic bundler failure'));
    expect(fallback).toBe('Generic bundler failure');

    const nonErrorFallback = formatBuildError('Unexpected string error');
    expect(nonErrorFallback).toBe('Unexpected string error');
  });

  test('14. requesting /index.html directly serves HTML with injected HMR script', async () => {
    const res = await fetch(`${devBase}/index.html`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('ws-hmr');
    expect(html).toContain('<div id="app"></div>');
  });

  test('15. production build assets are minified and free of multi-line comments', async () => {
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

  test('16. preview server returns 404 for nonexistent files', async () => {
    const previewServer = previewProduction(0);
    const previewBase = `http://localhost:${previewServer.port}`;

    try {
      const res = await fetch(`${previewBase}/missing-file.txt`);
      expect(res.status).toBe(404);
    } finally {
      previewServer.stop(true);
    }
  });

  test('17. HMR client script defines Escape key listener and backdrop dismissal', async () => {
    const res = await fetch(`${devBase}/`);
    const html = await res.text();
    expect(html).toContain('e.key === "Escape"');
    expect(html).toContain('e.target === overlay');
  });

  test('18. HMR client script defines CSS link hot-swap clone logic', async () => {
    const res = await fetch(`${devBase}/`);
    const html = await res.text();
    expect(html).toContain('link.cloneNode()');
    expect(html).toContain('newLink.onload = () => link.remove()');
    expect(html).toContain('payload.timestamp');
  });

  test('19. HMR client script defines active input focus and selection range preservation', async () => {
    const res = await fetch(`${devBase}/`);
    const html = await res.text();
    expect(html).toContain('#todo-input');
    expect(html).toContain('prevInput.selectionStart');
    expect(html).toContain('prevInput.selectionEnd');
    expect(html).toContain('newInput.setSelectionRange');
  });

  test('20. dev server with enableLiveReload=false omits HMR client script', async () => {
    const staticDevServer = createDevServer(0, false);
    const staticBase = `http://localhost:${staticDevServer.port}`;

    try {
      const res = await fetch(`${staticBase}/`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain('ws-hmr');
    } finally {
      staticDevServer.stop(true);
    }
  });
});
