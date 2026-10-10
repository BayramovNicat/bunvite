type Filter = 'all' | 'active' | 'completed';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

const STORAGE_KEY = 'bunvite_todos';
const state = {
  todos: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Todo[],
  filter: 'all' as Filter,
};

const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));

const root = document.querySelector('#app') as HTMLElement;
root.className = 'size-full flex flex-col items-center justify-center p-4 sm:p-6';

const render = () => {
  const visible = state.todos.filter((t) => (state.filter === 'active' ? !t.completed : state.filter === 'completed' ? t.completed : true));
  const remaining = state.todos.filter((t) => !t.completed).length;

  root.replaceChildren(
    <div class="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <header class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-semibold text-zinc-100 tracking-tight">BunVite</h1>
          <span class="badge text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{state.todos.length}</span>
        </div>
      </header>

      <form id="todo-form" class="p-4 border-b border-zinc-800" onSubmit={(e: Event) => {
        e.preventDefault();
        const input = (e.target as HTMLFormElement).elements.namedItem('task') as HTMLInputElement;
        const text = input.value.trim();
        if (!text) return;
        state.todos.push({ id: crypto.randomUUID(), text, completed: false });
        save();
        render();
      }}>
        <div class="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-colors">
          <input id="todo-input" name="task" placeholder="Add a new task..." autoComplete="off" aria-label="Add a task" class="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 focus:outline-hidden" />
          <button type="submit" aria-label="Add task" class="text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer">
            <svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14" /><path d="M12 5v14" />
            </svg>
          </button>
        </div>
      </form>

      <ul class="max-h-96 overflow-y-auto list-none p-0 m-0">
        {visible.length === 0 ? (
          <li class="text-zinc-500 text-xs text-center py-8">No tasks</li>
        ) : (
          visible.map((t) => (
            <li class="todo-item group flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors border-b border-zinc-800/60" data-id={t.id}>
              <button
                type="button"
                data-action="toggle"
                aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                class={`shrink-0 size-4.5 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                  t.completed ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600 hover:border-zinc-400 bg-transparent'
                }`}
                onClick={() => { t.completed = !t.completed; save(); render(); }}
              >
                {t.completed && (
                  <svg class="size-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
              <span
                class={`todo-text flex-1 text-sm select-none transition-colors cursor-pointer ${t.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}
                data-action="toggle"
                onClick={() => { t.completed = !t.completed; save(); render(); }}
              >
                {t.text}
              </span>
              <button
                type="button"
                data-action="delete"
                aria-label="Delete task"
                class="delete-btn size-6 flex items-center justify-center rounded text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-200 hover:bg-white/5 transition-all cursor-pointer"
                onClick={() => {
                  const idx = state.todos.findIndex((x) => x.id === t.id);
                  if (idx !== -1) { state.todos.splice(idx, 1); save(); render(); }
                }}
              >
                <svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </li>
          ))
        )}
      </ul>

      <footer class="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-950/40">
        <span class="remaining text-xs text-zinc-400">{remaining} remaining</span>
        <div class="flex items-center gap-1">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              type="button"
              data-filter={f}
              class={`filter-btn text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer capitalize ${
                state.filter === f ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              onClick={() => { state.filter = f; render(); }}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          type="button"
          id="clear-btn"
          data-action="clear"
          class="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          onClick={() => {
            for (let i = state.todos.length - 1; i >= 0; i--) if (state.todos[i].completed) state.todos.splice(i, 1);
            save();
            render();
          }}
        >
          Clear
        </button>
      </footer>
    </div>,
  );
};

render();
