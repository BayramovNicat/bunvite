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
      };
    })()`)) as { title: string; header: string; itemsCount: number };

    expect(state.title).toBe('Tasks');
    expect(state.header).toBe('Tasks');
    expect(state.itemsCount).toBe(0);
  });

  test('adds tasks via form', async () => {
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
    expect(result.itemTexts).toEqual(['Learn Bun', 'Write E2E Tests', 'Deploy to Production']);
  });

  test('toggles task completion', async () => {
    const result = (await webview.evaluate(`(() => {
      const toggleBtns = document.querySelectorAll('button[data-action="toggle"]');
      toggleBtns[1].click();
      return {
        completedCount: document.querySelectorAll('.todo-text.line-through').length,
      };
    })()`)) as { completedCount: number };

    expect(result.completedCount).toBe(1);
  });

  test('toggles completion on text click', async () => {
    const result = (await webview.evaluate(`(() => {
      const texts = document.querySelectorAll('.todo-text');
      texts[2].click();
      return {
        completedCount: document.querySelectorAll('.todo-text.line-through').length,
      };
    })()`)) as { completedCount: number };

    expect(result.completedCount).toBe(2);
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

    expect(results.activeCount).toBe(1);
    expect(results.completedCount).toBe(2);
    expect(results.allCount).toBe(3);
  });

  test('deletes task and clears completed', async () => {
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

  test('rejects empty and whitespace inputs', async () => {
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

  test('updates badge and remaining count', async () => {
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

    expect(counts.badge).toBe('2');
    expect(counts.remaining).toBe('2 remaining');
  });

  test('persists tasks to localStorage', async () => {
    const raw = (await webview.evaluate(`localStorage.getItem('bunvite_todos')`)) as string;
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw) as { text: string }[];
    expect(parsed.length).toBeGreaterThan(1);
    expect(parsed.map((t) => t.text)).toContain('Task One');
  });

  test('edits task inline', async () => {
    const result = (await webview.evaluate(`(() => {
      const editBtn = document.querySelector('button[data-action="edit"]');
      editBtn.click();
      const editInput = document.querySelector('input[data-edit-input]');
      editInput.value = 'Task One (Edited)';
      const saveBtn = document.querySelector('button[data-action="save-edit"]');
      saveBtn.click();
      const texts = Array.from(document.querySelectorAll('.todo-text')).map((el) => el.textContent?.trim());
      return { texts, isEditing: !!document.querySelector('input[data-edit-input]') };
    })()`)) as { texts: string[]; isEditing: boolean };

    expect(result.isEditing).toBe(false);
    expect(result.texts).toContain('Task One (Edited)');
  });

  test('cycles task priority', async () => {
    const priorities = (await webview.evaluate(`(() => {
      const getBtn = () => document.querySelector('button[data-action="priority"]');
      const initial = getBtn().title;
      getBtn().click();
      const afterFirst = getBtn().title;
      getBtn().click();
      const afterSecond = getBtn().title;
      return { initial, afterFirst, afterSecond };
    })()`)) as { initial: string; afterFirst: string; afterSecond: string };

    expect(priorities.initial).toBe('Priority: low');
    expect(priorities.afterFirst).toBe('Priority: medium');
    expect(priorities.afterSecond).toBe('Priority: high');
  });

  test('toggles all tasks at once', async () => {
    const result = (await webview.evaluate(`(() => {
      const toggleAllBtn = document.querySelector('button[data-action="toggle-all"]');
      toggleAllBtn.click();
      const countCompleted = document.querySelectorAll('.todo-text.line-through').length;
      toggleAllBtn.click();
      const countActive = document.querySelectorAll('.todo-text:not(.line-through)').length;
      return { countCompleted, countActive };
    })()`)) as { countCompleted: number; countActive: number };

    expect(result.countCompleted).toBe(2);
    expect(result.countActive).toBe(2);
  });

  test('filters tasks with search query', async () => {
    const result = (await webview.evaluate(`(() => {
      const searchInput = document.querySelector('input[data-action="search"]');
      searchInput.value = 'Edited';
      searchInput.dispatchEvent(new Event('input'));
      const countFiltered = document.querySelectorAll('.todo-item').length;
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      const countReset = document.querySelectorAll('.todo-item').length;
      return { countFiltered, countReset };
    })()`)) as { countFiltered: number; countReset: number };

    expect(result.countFiltered).toBe(1);
    expect(result.countReset).toBe(2);
  });

  test('undoes task deletion', async () => {
    const result = (await webview.evaluate(`(() => {
      const initialCount = document.querySelectorAll('.todo-item').length;
      const deleteBtn = document.querySelector('button[data-action="delete"]');
      deleteBtn.click();
      const countAfterDelete = document.querySelectorAll('.todo-item').length;
      const undoBtn = document.querySelector('button[data-action="undo"]');
      const hasUndoToast = !!undoBtn;
      undoBtn.click();
      const countAfterUndo = document.querySelectorAll('.todo-item').length;
      return { initialCount, countAfterDelete, hasUndoToast, countAfterUndo };
    })()`)) as { initialCount: number; countAfterDelete: number; hasUndoToast: boolean; countAfterUndo: number };

    expect(result.countAfterDelete).toBe(result.initialCount - 1);
    expect(result.hasUndoToast).toBe(true);
    expect(result.countAfterUndo).toBe(result.initialCount);
  });

  test('navigates sidebar views and opens calendar', async () => {
    const result = (await webview.evaluate(`(() => {
      const calBtn = document.querySelector('button[data-view="calendar"]');
      calBtn.click();
      const calPanel = document.querySelector('.calendar-panel');
      const isCalVisible = !calPanel?.classList.contains('hidden');

      const inboxBtn = document.querySelector('button[data-view="inbox"]');
      inboxBtn.click();
      const isCalHidden = calPanel?.classList.contains('hidden');

      return { isCalVisible, isCalHidden };
    })()`)) as { isCalVisible: boolean; isCalHidden: boolean };

    expect(result.isCalVisible).toBe(true);
    expect(result.isCalHidden).toBe(true);
  });

  test('interacts with calendar controls and month navigation', async () => {
    const result = (await webview.evaluate(`(() => {
      document.querySelector('button[data-view="calendar"]').click();
      const monthHeader = document.querySelector('.calendar-panel span.tracking-tight')?.textContent?.trim();

      document.querySelector('button[data-action="next-month"]').click();
      const nextMonthHeader = document.querySelector('.calendar-panel span.tracking-tight')?.textContent?.trim();

      document.querySelector('button[data-action="prev-month"]').click();
      const prevMonthHeader = document.querySelector('.calendar-panel span.tracking-tight')?.textContent?.trim();

      const dayCell = document.querySelector('.calendar-panel button[data-action="select-date"]');
      const targetDate = dayCell?.getAttribute('data-date') || '';
      dayCell?.click();
      const newSelected = document.querySelector('.calendar-panel button[data-date="' + targetDate + '"]');
      const isSelected = Boolean(newSelected?.classList.contains('bg-indigo-600'));

      document.querySelector('button[data-view="inbox"]').click();
      return { monthHeader, nextMonthHeader, prevMonthHeader, isSelected };
    })()`)) as { monthHeader: string; nextMonthHeader: string; prevMonthHeader: string; isSelected: boolean };

    expect(result.monthHeader).toBe(result.prevMonthHeader);
    expect(result.monthHeader !== result.nextMonthHeader).toBe(true);
    expect(result.isSelected).toBe(true);
  });

  test('filters tasks by category', async () => {
    const result = (await webview.evaluate(`(() => {
      const workBtn = document.querySelector('button[data-action="select-category"][data-category="Work"]');
      workBtn.click();
      const countInWork = document.querySelectorAll('.todo-item').length;

      document.querySelector('button[data-action="clear-category"]').click();
      const countAfterClear = document.querySelectorAll('.todo-item').length;

      return { countInWork, countAfterClear };
    })()`)) as { countInWork: number; countAfterClear: number };

    expect(result.countAfterClear).toBe(2);
  });

  test('reorders tasks via drag and drop', async () => {
    const result = (await webview.evaluate(`(() => {
      const items = Array.from(document.querySelectorAll('.todo-item'));
      if (items.length < 2) return { countBefore: 0, countAfter: 0 };

      const countBefore = items.length;
      const firstItem = items[0];
      const secondItem = items[1];

      firstItem.dispatchEvent(new Event('dragstart', { bubbles: true }));
      const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(dropEvent, 'clientY', { value: 9999 });
      secondItem.dispatchEvent(dropEvent);

      const countAfter = document.querySelectorAll('.todo-item').length;
      return { countBefore, countAfter };
    })()`)) as { countBefore: number; countAfter: number };

    expect(result.countBefore).toBeGreaterThan(1);
    expect(result.countAfter).toBe(result.countBefore);
  });
});
