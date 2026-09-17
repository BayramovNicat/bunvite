import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';
import { createDevServer } from '../vite';

describe('todo app', () => {
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

  test('renders initial empty state', async () => {
    const state = (await webview.evaluate(`(async () => {
      while (!document.querySelector('h1')) {
        await new Promise(r => setTimeout(r, 10));
      }
      return {
        title: document.title,
        header: document.querySelector('h1')?.textContent?.trim(),
        itemsCount: document.querySelectorAll('.todo-item').length,
        emptyText: document.querySelector('ul')?.textContent?.trim(),
      };
    })()`)) as { title: string; header: string; itemsCount: number; emptyText: string };

    expect(state.title).toBe('BunVite');
    expect(state.header).toBe('BunVite');
    expect(state.itemsCount).toBe(0);
    expect(state.emptyText).toBe('No tasks');
  });

  test('adds tasks via form', async () => {
    const result = (await webview.evaluate(`(() => {
      const input = document.querySelector('#todo-input');
      const form = document.querySelector('#todo-form');
      ['Learn Bun', 'Write Tests', 'Deploy App'].forEach((task) => {
        input.value = task;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      });
      return {
        itemsCount: document.querySelectorAll('.todo-item').length,
        itemTexts: Array.from(document.querySelectorAll('.todo-text')).map((el) => el.textContent?.trim()),
        badge: document.querySelector('.badge')?.textContent?.trim(),
        remaining: document.querySelector('.remaining')?.textContent?.trim(),
      };
    })()`)) as { itemsCount: number; itemTexts: string[]; badge: string; remaining: string };

    expect(result.itemsCount).toBe(3);
    expect(result.itemTexts).toEqual(['Learn Bun', 'Write Tests', 'Deploy App']);
    expect(result.badge).toBe('3');
    expect(result.remaining).toBe('3 remaining');
  });

  test('toggles task completion', async () => {
    const result = (await webview.evaluate(`(() => {
      const toggleBtns = document.querySelectorAll('button[data-action="toggle"]');
      toggleBtns[1].click();
      return {
        completedCount: document.querySelectorAll('.todo-text.line-through').length,
        remaining: document.querySelector('.remaining')?.textContent?.trim(),
      };
    })()`)) as { completedCount: number; remaining: string };

    expect(result.completedCount).toBe(1);
    expect(result.remaining).toBe('2 remaining');
  });

  test('filters by active and completed', async () => {
    const results = (await webview.evaluate(`(() => {
      document.querySelector('[data-filter="active"]').click();
      const activeCount = document.querySelectorAll('.todo-item').length;

      document.querySelector('[data-filter="completed"]').click();
      const completedCount = document.querySelectorAll('.todo-item').length;

      document.querySelector('[data-filter="all"]').click();
      const allCount = document.querySelectorAll('.todo-item').length;

      return { activeCount, completedCount, allCount };
    })()`)) as { activeCount: number; completedCount: number; allCount: number };

    expect(results.activeCount).toBe(2);
    expect(results.completedCount).toBe(1);
    expect(results.allCount).toBe(3);
  });

  test('deletes task and clears completed', async () => {
    const result = (await webview.evaluate(`(() => {
      const firstDeleteBtn = document.querySelector('.todo-item button[data-action="delete"]');
      firstDeleteBtn.click();
      const countAfterDelete = document.querySelectorAll('.todo-item').length;

      document.querySelector('#clear-btn').click();
      const finalCount = document.querySelectorAll('.todo-item').length;
      const remainingTask = document.querySelector('.todo-text')?.textContent?.trim();

      return { countAfterDelete, finalCount, remainingTask };
    })()`)) as { countAfterDelete: number; finalCount: number; remainingTask: string };

    expect(result.countAfterDelete).toBe(2);
    expect(result.finalCount).toBe(1);
    expect(result.remainingTask).toBe('Deploy App');
  });

  test('rejects empty and whitespace inputs', async () => {
    const result = (await webview.evaluate(`(() => {
      const input = document.querySelector('#todo-input');
      const form = document.querySelector('#todo-form');
      const countBefore = document.querySelectorAll('.todo-item').length;

      input.value = '   ';
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      input.value = '';
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      const countAfter = document.querySelectorAll('.todo-item').length;
      return { countBefore, countAfter };
    })()`)) as { countBefore: number; countAfter: number };

    expect(result.countBefore).toBe(1);
    expect(result.countAfter).toBe(1);
  });

  test('persists tasks to localStorage', async () => {
    const raw = (await webview.evaluate(`localStorage.getItem('bunvite_todos')`)) as string;
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw) as { text: string }[];
    expect(parsed.length).toBe(1);
    expect(parsed[0].text).toBe('Deploy App');
  });
});
