import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';
import { createDevServer } from '../vite';

describe('showcase starter app', () => {
  let server: Server<unknown>;
  let webview: Bun.WebView;

  beforeAll(async () => {
    server = createDevServer(0, false);
    webview = new Bun.WebView();
    await webview.navigate(`http://localhost:${server.port}`);
  });

  afterAll(async () => {
    await webview.close();
    server.stop(true);
  });

  test('renders initial hero and counter state', async () => {
    const state = (await webview.evaluate(`(async () => {
      while (!document.querySelector('h1')) {
        await new Promise(r => setTimeout(r, 10));
      }
      return {
        title: document.title,
        header: document.querySelector('h1')?.textContent?.trim(),
        counter: document.querySelector('#counter')?.textContent?.trim(),
        hasIncrementBtn: !!document.querySelector('#increment-btn'),
      };
    })()`)) as { title: string; header: string; counter: string; hasIncrementBtn: boolean };

    expect(state.title).toBe('BunVite');
    expect(state.header).toBe('BunVite');
    expect(state.counter).toBe('0');
    expect(state.hasIncrementBtn).toBe(true);
  });

  test('increments counter on button click', async () => {
    const result = (await webview.evaluate(`(() => {
      const btn = document.querySelector('#increment-btn');
      btn.click();
      btn.click();
      btn.click();
      return document.querySelector('#counter')?.textContent?.trim();
    })()`)) as string;

    expect(result).toBe('3');
  });
});
