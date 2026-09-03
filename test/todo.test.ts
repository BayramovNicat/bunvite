import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import type { Server } from "bun";
import { createAppServer } from "../src/server";

describe("Native Todo App E2E Test Suite", () => {
  let server: Server<unknown>;
  let baseUrl: string;

  beforeAll(() => {
    server = createAppServer(0); // ephemeral random port
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
  });

  test("1. renders initial empty state correctly", async () => {
    await using webview = new Bun.WebView();
    await webview.navigate(baseUrl);

    const title = (await webview.evaluate("document.title")) as string;
    const headerText = (await webview.evaluate("document.querySelector('h1')?.textContent")) as string;
    const countText = (await webview.evaluate("document.querySelector('#todo-count')?.textContent")) as string;
    const emptyStateDisplay = (await webview.evaluate(
      "window.getComputedStyle(document.querySelector('#empty-state')).display"
    )) as string;

    expect(title).toBe("Native Bun Todo App");
    expect(headerText).toBe("Bun Todos");
    expect(countText).toBe("0 items left");
    expect(emptyStateDisplay).not.toBe("none");
  });

  test("2. adds new todos and updates counter", async () => {
    await using webview = new Bun.WebView();
    await webview.navigate(baseUrl);

    // Add first todo: "Buy groceries"
    await webview.click("#todo-input");
    await webview.type("Buy groceries");
    await webview.click("#add-todo-btn");

    // Add second todo: "Write Bun tests"
    await webview.click("#todo-input");
    await webview.type("Write Bun tests");
    await webview.click("#add-todo-btn");

    const itemsCount = (await webview.evaluate("document.querySelectorAll('.todo-item').length")) as number;
    const countText = (await webview.evaluate("document.querySelector('#todo-count')?.textContent")) as string;
    const firstItemText = (await webview.evaluate("document.querySelectorAll('.todo-text')[0]?.textContent")) as string;
    const secondItemText = (await webview.evaluate("document.querySelectorAll('.todo-text')[1]?.textContent")) as string;

    expect(itemsCount).toBe(2);
    expect(countText).toBe("2 items left");
    expect(firstItemText).toBe("Buy groceries");
    expect(secondItemText).toBe("Write Bun tests");
  });

  test("3. toggles todo completion", async () => {
    await using webview = new Bun.WebView();
    await webview.navigate(baseUrl);

    // Add a todo
    await webview.click("#todo-input");
    await webview.type("Complete this task");
    await webview.click("#add-todo-btn");

    // Toggle completion checkbox
    await webview.click(".todo-checkbox");

    const isCompleted = (await webview.evaluate("document.querySelector('.todo-item').classList.contains('completed')")) as boolean;
    const countText = (await webview.evaluate("document.querySelector('#todo-count')?.textContent")) as string;

    expect(isCompleted).toBe(true);
    expect(countText).toBe("0 items left");
  });

  test("4. filters active and completed todos", async () => {
    await using webview = new Bun.WebView();
    await webview.navigate(baseUrl);

    // Add 2 tasks
    await webview.click("#todo-input");
    await webview.type("Task 1 (Active)");
    await webview.click("#add-todo-btn");

    await webview.click("#todo-input");
    await webview.type("Task 2 (Completed)");
    await webview.click("#add-todo-btn");

    // Complete Task 2
    await webview.evaluate(`(() => {
      const checkboxes = document.querySelectorAll(".todo-checkbox");
      checkboxes[1].click();
    })()`);

    // Filter: Active
    await webview.click("#filter-active");
    const activeItems = (await webview.evaluate("document.querySelectorAll('.todo-item').length")) as number;
    const activeText = (await webview.evaluate("document.querySelector('.todo-text')?.textContent")) as string;
    expect(activeItems).toBe(1);
    expect(activeText).toBe("Task 1 (Active)");

    // Filter: Completed
    await webview.click("#filter-completed");
    const completedItems = (await webview.evaluate("document.querySelectorAll('.todo-item').length")) as number;
    const completedText = (await webview.evaluate("document.querySelector('.todo-text')?.textContent")) as string;
    expect(completedItems).toBe(1);
    expect(completedText).toBe("Task 2 (Completed)");

    // Filter: All
    await webview.click("#filter-all");
    const allItems = (await webview.evaluate("document.querySelectorAll('.todo-item').length")) as number;
    expect(allItems).toBe(2);
  });

  test("5. deletes a todo item", async () => {
    await using webview = new Bun.WebView();
    await webview.navigate(baseUrl);

    // Add a todo
    await webview.click("#todo-input");
    await webview.type("Task to delete");
    await webview.click("#add-todo-btn");

    const countBefore = (await webview.evaluate("document.querySelectorAll('.todo-item').length")) as number;
    expect(countBefore).toBe(1);

    // Click delete button
    await webview.click(".delete-btn");

    const countAfter = (await webview.evaluate("document.querySelectorAll('.todo-item').length")) as number;
    const finalCountText = (await webview.evaluate("document.querySelector('#todo-count')?.textContent")) as string;

    expect(countAfter).toBe(0);
    expect(finalCountText).toBe("0 items left");
  });
});
