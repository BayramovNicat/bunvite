import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { createDevServer } from "../vite";

describe("BunVite Dev Engine & Todo App E2E Suite", () => {
	let server: Server<unknown>;
	let baseUrl: string;
	let webview: Bun.WebView;

	beforeAll(async () => {
		server = createDevServer(0, false);
		baseUrl = `http://localhost:${server.port}`;

		webview = new Bun.WebView();
		await webview.navigate(baseUrl);
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
        count: document.querySelector('#todo-count')?.textContent,
        itemsCount: document.querySelectorAll('.todo-item').length,
        emptyVisible: !document.querySelector('#empty-state')?.classList.contains('hidden')
      };
    })()`)) as {
			title: string;
			header: string;
			count: string;
			itemsCount: number;
			emptyVisible: boolean;
		};

		expect(state.title).toBe("BunVite • Native Todo App");
		expect(state.header).toBe("Bun Todos");
		expect(state.count).toBe("0 items left");
		expect(state.itemsCount).toBe(0);
		expect(state.emptyVisible).toBe(true);
	});

	test("2. fast batch-add tasks and verify live DOM", async () => {
		const result = (await webview.evaluate(`(() => {
      const input = document.querySelector('#todo-input');
      const form = document.querySelector('#todo-form');
      const tasks = ["Learn Bun", "Write E2E Tests", "Deploy to Production"];

      tasks.forEach(task => {
        input.value = task;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      });

      return {
        itemsCount: document.querySelectorAll('.todo-item').length,
        countText: document.querySelector('#todo-count')?.textContent,
        itemTexts: Array.from(document.querySelectorAll('.todo-text')).map(el => el.textContent?.trim())
      };
    })()`)) as {
			itemsCount: number;
			countText: string;
			itemTexts: string[];
		};

		expect(result.itemsCount).toBe(3);
		expect(result.countText).toBe("3 items left");
		expect(result.itemTexts).toEqual(["Learn Bun", "Write E2E Tests", "Deploy to Production"]);
	});

	test("3. toggle task completion", async () => {
		const result = (await webview.evaluate(`(() => {
      const checkboxes = document.querySelectorAll('.todo-checkbox');
      checkboxes[1].click();

      return {
        completedCount: document.querySelectorAll('.todo-item.completed').length,
        countText: document.querySelector('#todo-count')?.textContent
      };
    })()`)) as {
			completedCount: number;
			countText: string;
		};

		expect(result.completedCount).toBe(1);
		expect(result.countText).toBe("2 items left");
	});

	test("4. test view filters (Active, Completed, All)", async () => {
		const filterResults = (await webview.evaluate(`(() => {
      document.querySelector('#filter-active').click();
      const activeCount = document.querySelectorAll('.todo-item').length;
      const activeText = document.querySelector('.todo-text')?.textContent?.trim();

      document.querySelector('#filter-completed').click();
      const completedCount = document.querySelectorAll('.todo-item').length;
      const completedText = document.querySelector('.todo-text')?.textContent?.trim();

      document.querySelector('#filter-all').click();
      const allCount = document.querySelectorAll('.todo-item').length;

      return { activeCount, activeText, completedCount, completedText, allCount };
    })()`)) as {
			activeCount: number;
			activeText: string;
			completedCount: number;
			completedText: string;
			allCount: number;
		};

		expect(filterResults.activeCount).toBe(2);
		expect(filterResults.activeText).toBe("Learn Bun");
		expect(filterResults.completedCount).toBe(1);
		expect(filterResults.completedText).toBe("Write E2E Tests");
		expect(filterResults.allCount).toBe(3);
	});

	test("5. delete task and clear completed", async () => {
		const finalState = (await webview.evaluate(`(() => {
      document.querySelectorAll('.delete-btn')[0].click();
      const countAfterDelete = document.querySelectorAll('.todo-item').length;

      document.querySelector('#clear-completed-btn').click();
      const finalCount = document.querySelectorAll('.todo-item').length;
      const finalCountText = document.querySelector('#todo-count')?.textContent;
      const remainingTask = document.querySelector('.todo-text')?.textContent?.trim();

      return { countAfterDelete, finalCount, finalCountText, remainingTask };
    })()`)) as {
			countAfterDelete: number;
			finalCount: number;
			finalCountText: string;
			remainingTask: string;
		};

		expect(finalState.countAfterDelete).toBe(2);
		expect(finalState.finalCount).toBe(1);
		expect(finalState.finalCountText).toBe("1 item left");
		expect(finalState.remainingTask).toBe("Deploy to Production");
	});
});
