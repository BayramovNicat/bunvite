export type Filter = 'all' | 'active' | 'completed';
export type Priority = 'low' | 'medium' | 'high';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority?: Priority;
}

export interface AppState {
  todos: Todo[];
  filter: Filter;
  search: string;
  editingId: string | null;
  lastDeleted: { items: Todo[] } | null;
}

const STORAGE_KEY = 'bunvite_todos';

const loadSavedTodos = (): Todo[] => {
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

declare global {
  interface Window {
    __hmr_state__?: AppState;
  }
}

var state: AppState = (window.__hmr_state__ ??= {
  todos: loadSavedTodos(),
  filter: 'all',
  search: '',
  editingId: null,
  lastDeleted: null,
});

const Check = /*svg*/ `<svg class="size-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const Close = /*svg*/ `<svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const Plus = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
const Pencil = /*svg*/ `<svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
const CheckCheck = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>`;
const Grip = /*svg*/ `<svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;

const root = document.querySelector('#app') as HTMLElement;

root.className = 'w-full max-w-95 relative';
root.innerHTML = /*html*/ `
  <div class="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-sm">
    <header class="flex items-center justify-between px-5 pt-5 pb-4">
      <div class="flex items-center gap-2">
        <h1 class="text-base font-semibold text-zinc-100 tracking-tight">Tasks</h1>
        <div class="badge-slot"></div>
      </div>
      <div class="flex items-center gap-1.5">
        <input type="search" data-action="search" value="" placeholder="Search..." autocomplete="off" class="w-20 focus:w-28 transition-all duration-150 bg-zinc-800/50 border border-zinc-700/40 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500/50" />
        <button type="button" data-action="toggle-all" title="Toggle all" class="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors cursor-pointer">${CheckCheck}</button>
      </div>
    </header>
    <div class="px-4 pb-4">
      <form id="todo-form" class="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-all duration-150">
        <input id="todo-input" name="task" placeholder="Add a task... (/ to focus)" autocomplete="off" class="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden" />
        <button type="submit" class="text-zinc-600 hover:text-indigo-400 transition-colors cursor-pointer">${Plus}</button>
      </form>
    </div>
    <ul class="divide-y divide-zinc-800/60 border-t border-zinc-800/60"></ul>
    <footer class="flex items-center justify-between px-5 py-3 border-t border-zinc-800/60"></footer>
  </div>
  <div class="toast-slot fixed bottom-5 left-1/2 -translate-x-1/2 pointer-events-none"></div>
`;

const badgeSlot = root.querySelector('.badge-slot') as HTMLElement;
const list = root.querySelector('ul') as HTMLElement;
const footer = root.querySelector('footer') as HTMLElement;
const form = root.querySelector('#todo-form') as HTMLFormElement;
const toastSlot = root.querySelector('.toast-slot') as HTMLElement;
const searchInput = root.querySelector('input[data-action="search"]') as HTMLInputElement;

let undoTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleUndoDismiss = () => {
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    state.lastDeleted = null;
    render();
  }, 4000);
};

const commitEdit = (id: string | null, newText: string) => {
  const trimmed = newText.trim();
  if (trimmed) {
    const item = state.todos.find((t) => t.id === id);
    if (item) item.text = trimmed;
  } else if (id) {
    state.todos = state.todos.filter((t) => t.id !== id);
  }
  state.editingId = null;
  saveTodos(state.todos);
  render();
};

const render = () => {
  const query = state.search.toLowerCase().trim();
  const visible = state.todos.filter((t) => {
    const matchesFilter =
      state.filter === 'active' ? !t.completed : state.filter === 'completed' ? t.completed : true;
    const matchesSearch = !query || t.text.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  const active = state.todos.filter((t) => !t.completed).length;

  badgeSlot.innerHTML = state.todos.length
    ? /*html*/ `<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">${state.todos.length}</span>`
    : '';

  const emptyMessage = state.search
    ? 'No matching tasks'
    : state.filter === 'active'
      ? 'No active tasks'
      : state.filter === 'completed'
        ? 'No completed tasks'
        : 'No tasks here';

  list.innerHTML = visible.length
    ? visible
        .map((t) => {
          if (state.editingId === t.id) {
            return /*html*/ `
              <li class="todo-item flex items-center gap-2 px-4 py-2.5 bg-zinc-800/50" data-id="${t.id}">
                <input type="text" data-edit-input="${t.id}" value="${t.text.replace(/"/g, '&quot;')}" class="flex-1 bg-zinc-800 border border-indigo-500/80 rounded-lg px-2.5 py-1 text-sm text-zinc-100 focus:outline-hidden" />
                <button type="button" data-action="save-edit" class="text-xs px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors cursor-pointer">Save</button>
                <button type="button" data-action="cancel-edit" class="text-xs px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">Cancel</button>
              </li>
            `;
          }

          const priorityClass =
            t.priority === 'high'
              ? 'bg-rose-500 ring-2 ring-rose-500/20'
              : t.priority === 'medium'
                ? 'bg-amber-400 ring-2 ring-amber-500/20'
                : 'bg-zinc-700 hover:bg-zinc-500';

          return /*html*/ `
            <li class="todo-item group flex items-center gap-2.5 px-4 py-3.5 hover:bg-white/2 transition-colors cursor-grab active:cursor-grabbing" data-id="${t.id}" draggable="true">
              <span class="opacity-0 group-hover:opacity-40 hover:opacity-100 text-zinc-500 shrink-0 select-none">${Grip}</span>
              <button type="button" data-action="toggle" class="shrink-0 size-4.5 rounded-full border transition-all cursor-pointer flex items-center justify-center ${t.completed ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600 hover:border-zinc-400 bg-transparent'}">
                ${t.completed ? Check : ''}
              </button>
              <button type="button" data-action="priority" title="Priority: ${t.priority ?? 'low'}" class="shrink-0 size-2 rounded-full cursor-pointer transition-colors ${priorityClass}"></button>
              <span class="todo-text flex-1 text-sm leading-relaxed select-none transition-colors cursor-pointer ${t.completed ? 'line-through text-zinc-600' : 'text-zinc-200'}" data-action="toggle">${t.text}</span>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" data-action="edit" title="Edit task" class="size-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all cursor-pointer">${Pencil}</button>
                <button type="button" data-action="delete" title="Delete task" class="delete-btn size-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all cursor-pointer">${Close}</button>
              </div>
            </li>
          `;
        })
        .join('')
    : /*html*/ `<p class="text-zinc-600 text-xs text-center py-8">${emptyMessage}</p>`;

  footer.innerHTML = /*html*/ `
    <span class="text-xs text-zinc-600">${active} remaining</span>
    <div class="flex items-center gap-0.5">
      ${(['all', 'active', 'completed'] as const)
        .map(
          (f) => /*html*/ `
        <button type="button" data-filter="${f}" class="text-xs px-3 py-1 rounded-full transition-all cursor-pointer capitalize ${state.filter === f ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-zinc-500 hover:text-zinc-300'}">${f === 'completed' ? 'Done' : f}</button>
      `,
        )
        .join('')}
    </div>
    <button type="button" id="clear-btn" data-action="clear" class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer">Clear</button>
  `;

  toastSlot.innerHTML = state.lastDeleted
    ? /*html*/ `
      <div class="flex items-center gap-2.5 bg-zinc-800 border border-zinc-700/80 text-xs text-zinc-200 px-3.5 py-2 rounded-xl shadow-xl pointer-events-auto backdrop-blur-sm">
        <span>${state.lastDeleted.items.length === 1 ? 'Task deleted' : `${state.lastDeleted.items.length} tasks cleared`}</span>
        <button type="button" data-action="undo" class="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer">Undo</button>
      </div>
    `
    : '';

  if (state.editingId) {
    const editInput = root.querySelector<HTMLInputElement>(`input[data-edit-input="${state.editingId}"]`);
    if (editInput) {
      editInput.focus();
      editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    }
  }
};

form.onsubmit = (e) => {
  e.preventDefault();
  const text = (form.elements.namedItem('task') as HTMLInputElement).value.trim();
  if (!text) return;
  state.todos.push({ id: crypto.randomUUID(), text, completed: false, priority: 'low' });
  saveTodos(state.todos);
  form.reset();
  render();
};

searchInput.oninput = () => {
  state.search = searchInput.value;
  render();
};

let draggedId: string | null = null;

root.ondragstart = (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-id]');
  if (!li) return;
  draggedId = li.dataset.id ?? null;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedId ?? '');
  }
};

root.ondragover = (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
};

root.ondrop = (e) => {
  e.preventDefault();
  const targetLi = (e.target as HTMLElement).closest<HTMLElement>('li[data-id]');
  if (!targetLi || !draggedId) return;
  const targetId = targetLi.dataset.id;
  if (!targetId || targetId === draggedId) return;

  const fromIndex = state.todos.findIndex((t) => t.id === draggedId);
  const toIndex = state.todos.findIndex((t) => t.id === targetId);
  if (fromIndex !== -1 && toIndex !== -1) {
    const [moved] = state.todos.splice(fromIndex, 1);
    state.todos.splice(toIndex, 0, moved);
    saveTodos(state.todos);
    render();
  }
  draggedId = null;
};

root.ondblclick = (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('.todo-text');
  if (!el) return;
  const id = el.closest<HTMLElement>('[data-id]')?.dataset.id;
  if (!id) return;
  const item = state.todos.find((t) => t.id === id);
  if (item) item.completed = !item.completed;
  state.editingId = id;
  render();
};

root.onkeydown = (e) => {
  const target = e.target as HTMLElement;
  if (target.hasAttribute('data-edit-input')) {
    const id = target.getAttribute('data-edit-input');
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(id, (target as HTMLInputElement).value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      state.editingId = null;
      render();
    }
  } else if (e.key === '/' && target.tagName !== 'INPUT') {
    e.preventDefault();
    (form.elements.namedItem('task') as HTMLInputElement).focus();
  }
};

root.onclick = (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-filter]');
  if (!el) return;

  const { action, filter } = el.dataset;
  const id = el.closest<HTMLElement>('[data-id]')?.dataset.id;
  const item = state.todos.find((t) => t.id === id);

  if (filter) {
    state.filter = filter as Filter;
  } else if (action === 'clear') {
    const completed = state.todos.filter((t) => t.completed);
    if (completed.length) {
      state.lastDeleted = { items: completed };
      state.todos = state.todos.filter((t) => !t.completed);
      scheduleUndoDismiss();
    }
  } else if (action === 'toggle' && item) {
    item.completed = !item.completed;
  } else if (action === 'toggle-all') {
    const hasActive = state.todos.some((t) => !t.completed);
    for (const t of state.todos) t.completed = hasActive;
  } else if (action === 'delete' && id) {
    const idx = state.todos.findIndex((t) => t.id === id);
    if (idx !== -1) {
      state.lastDeleted = { items: [state.todos[idx]] };
      state.todos.splice(idx, 1);
      scheduleUndoDismiss();
    }
  } else if (action === 'edit' && id) {
    state.editingId = id;
  } else if (action === 'save-edit' && id) {
    const editInput = root.querySelector<HTMLInputElement>(`input[data-edit-input="${id}"]`);
    if (editInput) commitEdit(id, editInput.value);
    return;
  } else if (action === 'cancel-edit') {
    state.editingId = null;
  } else if (action === 'priority' && item) {
    const cycle: Record<Priority, Priority> = { low: 'medium', medium: 'high', high: 'low' };
    item.priority = cycle[item.priority ?? 'low'];
  } else if (action === 'undo' && state.lastDeleted) {
    state.todos.push(...state.lastDeleted.items);
    state.lastDeleted = null;
    if (undoTimer) clearTimeout(undoTimer);
  } else {
    return;
  }

  saveTodos(state.todos);
  render();
};

render();
