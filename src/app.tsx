import { type Filter, type Todo, TodoCard, TodoItem } from './components/TodoCard';

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

const state: AppState = {
  todos: loadTodos(),
  filter: 'all',
};

const appTitle = 'BunVite';
const root = document.querySelector('#app') as HTMLElement;
root.className = 'size-full flex flex-col items-center justify-center p-4 sm:p-6';

const getVisibleTodos = (): Todo[] => {
  if (state.filter === 'active') return state.todos.filter((t) => !t.completed);
  if (state.filter === 'completed') return state.todos.filter((t) => t.completed);
  return state.todos;
};

const render = () => {
  const visible = getVisibleTodos();
  const activeCount = state.todos.filter((t) => !t.completed).length;

  root.replaceChildren(
    TodoCard({
      title: appTitle,
      count: state.todos.length,
      remaining: activeCount,
      activeFilter: state.filter,
    }),
  );

  const listEl = root.querySelector('ul') as HTMLUListElement;
  if (visible.length === 0) {
    listEl.replaceChildren(
      <li class="text-zinc-500 text-xs text-center py-8">No tasks</li>,
    );
  } else {
    listEl.replaceChildren(...visible.map((t) => TodoItem({ todo: t })));
  }

  const form = root.querySelector('#todo-form') as HTMLFormElement;
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
