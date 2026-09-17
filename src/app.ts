type Filter = 'all' | 'active' | 'completed';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

interface AppState {
  todos: Todo[];
  filter: Filter;
}

const STORAGE_KEY = 'bunvite_todos';

const loadTodos = (): Todo[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveTodos = (todos: Todo[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {}
};

let state: AppState = {
  todos: loadTodos(),
  filter: 'all',
};

const Check = /*svg*/ `<svg class="size-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const Close = /*svg*/ `<svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const Plus = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TodoItem = (t: Todo) => /*html*/ `
  <li class="todo-item group flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors border-b border-zinc-800/60" data-id="${t.id}">
    <button type="button" data-action="toggle" aria-label="${t.completed ? 'Mark incomplete' : 'Mark complete'}" class="shrink-0 size-4.5 rounded-full border transition-all cursor-pointer flex items-center justify-center ${t.completed ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600 hover:border-zinc-400 bg-transparent'}">
      ${t.completed ? Check : ''}
    </button>
    <span class="todo-text flex-1 text-sm select-none transition-colors cursor-pointer ${t.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}" data-action="toggle">${escapeHtml(t.text)}</span>
    <button type="button" data-action="delete" aria-label="Delete task" class="delete-btn size-6 flex items-center justify-center rounded text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-200 hover:bg-white/5 transition-all cursor-pointer">
      ${Close}
    </button>
  </li>
`;

const root = document.querySelector('#app') as HTMLElement;

root.className = 'size-full flex flex-col items-center justify-center p-4 sm:p-6';
root.innerHTML = /*html*/ `
  <div class="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
    <header class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
      <div class="flex items-center gap-2">
        <h1 class="text-lg font-semibold text-zinc-100 tracking-tight">Tasks</h1>
        <span class="badge text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">0</span>
      </div>
    </header>

    <form id="todo-form" class="p-4 border-b border-zinc-800">
      <div class="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-colors">
        <input id="todo-input" name="task" placeholder="Add a new task..." autocomplete="off" aria-label="Add a task" class="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 focus:outline-hidden" />
        <button type="submit" aria-label="Add task" class="text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer">
          ${Plus}
        </button>
      </div>
    </form>

    <ul class="max-h-96 overflow-y-auto list-none p-0 m-0"></ul>

    <footer class="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-950/40">
      <span class="remaining text-xs text-zinc-400">0 remaining</span>
      <div class="flex items-center gap-1">
        ${(['all', 'active', 'completed'] as const)
          .map(
            (f) => /*html*/ `
          <button type="button" data-filter="${f}" class="filter-btn text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer capitalize ${state.filter === f ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}">
            ${f}
          </button>
        `,
          )
          .join('')}
      </div>
      <button type="button" id="clear-btn" data-action="clear" class="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
        Clear
      </button>
    </footer>
  </div>
`;

const form = root.querySelector('#todo-form') as HTMLFormElement;
const listEl = root.querySelector('ul') as HTMLUListElement;
const badgeEl = root.querySelector('.badge') as HTMLElement;
const remainingEl = root.querySelector('.remaining') as HTMLElement;
const filterBtns = root.querySelectorAll<HTMLButtonElement>('.filter-btn');

const getVisibleTodos = (): Todo[] => {
  if (state.filter === 'active') return state.todos.filter((t) => !t.completed);
  if (state.filter === 'completed') return state.todos.filter((t) => t.completed);
  return state.todos;
};

const render = () => {
  const visible = getVisibleTodos();
  const activeCount = state.todos.filter((t) => !t.completed).length;

  badgeEl.textContent = String(state.todos.length);
  remainingEl.textContent = `${activeCount} remaining`;

  listEl.innerHTML = visible.length
    ? visible.map(TodoItem).join('')
    : /*html*/ `<li class="text-zinc-500 text-xs text-center py-8">No tasks</li>`;

  for (const btn of filterBtns) {
    const isCurrent = btn.dataset.filter === state.filter;
    btn.className = `filter-btn text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer capitalize ${isCurrent ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`;
  }
};

form.onsubmit = (e) => {
  e.preventDefault();
  const input = form.elements.namedItem('task') as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;

  state.todos.push({ id: crypto.randomUUID(), text, completed: false });
  saveTodos(state.todos);
  form.reset();
  render();
};

root.onclick = (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-filter]');
  if (!el) return;

  const { action, filter } = el.dataset;
  const id = el.closest<HTMLElement>('[data-id]')?.dataset.id;
  const item = state.todos.find((t) => t.id === id);

  if (filter) {
    state.filter = filter as Filter;
  } else if (action === 'toggle' && item) {
    item.completed = !item.completed;
  } else if (action === 'delete' && id) {
    state.todos = state.todos.filter((t) => t.id !== id);
  } else if (action === 'clear') {
    state.todos = state.todos.filter((t) => !t.completed);
  } else {
    return;
  }

  saveTodos(state.todos);
  render();
};

render();
