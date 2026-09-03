import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { createDevServer } from "../vite";

describe("BunVite Dev Engine & Todo App E2E Suite", () => {
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

  test("1. verify initial page state", async () => {
    const state = (await webview.evaluate(`(async () => {
      while (!document.querySelector('h1')) {
        await new Promise(r => setTimeout(r, 10));
      }
      return {
        title: document.title,
        header: document.querySelector('h1')?.textContent?.trim(),
        itemsCount: document.querySelectorAll('.todo-item').length,
      };
    })()`)) as { title: string; header: string; itemsCount: number };

    expect(state.title).toBe("Tasks");
    expect(state.header).toBe("Tasks");
    expect(state.itemsCount).toBe(0);
  });

  test("2. batch-add tasks and verify live DOM", async () => {
    const result = (await webview.evaluate(`(() => {
      const input = document.querySelector('#todo-input');
      const form = document.querySelector('#todo-form');
      ["Learn Bun", "Write E2E Tests", "Deploy to Production"].forEach(task => {
        input.value = task;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      });
      return {
        itemsCount: document.querySelectorAll('.todo-item').length,
        itemTexts: Array.from(document.querySelectorAll('.todo-text')).map(el => el.textContent?.trim()),
      };
    })()`)) as { itemsCount: number; itemTexts: string[] };

    expect(result.itemsCount).toBe(3);
    expect(result.itemTexts).toEqual(["Learn Bun", "Write E2E Tests", "Deploy to Production"]);
  });

  test("3. toggle task completion via circle button", async () => {
    const result = (await webview.evaluate(`(() => {
      const toggleBtns = document.querySelectorAll('button[data-action="toggle"]');
      toggleBtns[1].click();
      return {
        completedCount: document.querySelectorAll('.todo-text.line-through').length,
      };
    })()`)) as { completedCount: number };

    expect(result.completedCount).toBe(1);
  });

  test("4. toggle via text click", async () => {
    const result = (await webview.evaluate(`(() => {
      const texts = document.querySelectorAll('.todo-text');
      texts[2].click();
      return {
        completedCount: document.querySelectorAll('.todo-text.line-through').length,
      };
    })()`)) as { completedCount: number };

    expect(result.completedCount).toBe(2);
  });

  test("5. test view filters", async () => {
    const results = (await webview.evaluate(`(() => {
      document.querySelector('[data-filter="active"]').click();
      const activeCount = document.querySelectorAll('.todo-item').length;

      document.querySelector('[data-filter="completed"]').click();
      const completedCount = document.querySelectorAll('.todo-item').length;

      document.querySelector('[data-filter="all"]').click();
      const allCount = document.querySelectorAll('.todo-item').length;

      return { activeCount, completedCount, allCount };
    })()`)) as { activeCount: number; completedCount: number; allCount: number };

    expect(results.activeCount).toBe(1);
    expect(results.completedCount).toBe(2);
    expect(results.allCount).toBe(3);
  });

  test("6. delete task and clear completed", async () => {
    const finalState = (await webview.evaluate(`(() => {
      const firstItem = document.querySelector('.todo-item');
      const deleteBtn = firstItem.querySelector('[data-action="delete"]');
      deleteBtn.style.opacity = '1';
      deleteBtn.click();
      const countAfterDelete = document.querySelectorAll('.todo-item').length;

      document.querySelector('#clear-btn').click();
      const finalCount = document.querySelectorAll('.todo-item').length;
      const remainingTask = document.querySelector('.todo-text')?.textContent?.trim();

      return { countAfterDelete, finalCount, remainingTask };
    })()`)) as { countAfterDelete: number; finalCount: number; remainingTask: string };

    expect(finalState.countAfterDelete).toBe(2);
    expect(finalState.finalCount).toBe(0);
  });

  test("7. reject empty and whitespace tasks without adding items", async () => {
    const result = (await webview.evaluate(`(() => {
      const input = document.querySelector('#todo-input');
      const form = document.querySelector('#todo-form');
      const countBefore = document.querySelectorAll('.todo-item').length;

      input.value = "   ";
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      input.value = "";
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      const countAfter = document.querySelectorAll('.todo-item').length;
      return { countBefore, countAfter };
    })()`)) as { countBefore: number; countAfter: number };

    expect(result.countBefore).toBe(0);
    expect(result.countAfter).toBe(0);
  });

  test("8. verify counter badge and remaining count text", async () => {
    const counts = (await webview.evaluate(`(() => {
      const input = document.querySelector('#todo-input');
      const form = document.querySelector('#todo-form');

      input.value = "Task One";
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      input.value = "Task Two";
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      const badge = document.querySelector('header span')?.textContent?.trim();
      const remaining = document.querySelector('footer span')?.textContent?.trim();

      return { badge, remaining };
    })()`)) as { badge: string; remaining: string };

    expect(counts.badge).toBe("2");
    expect(counts.remaining).toBe("2 remaining");
  });
});
