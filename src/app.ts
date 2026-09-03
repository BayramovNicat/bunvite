// --- Types ---
export type Filter = "all" | "active" | "completed";

export interface Todo {
	readonly id: string;
	readonly text: string;
	readonly completed: boolean;
}

export interface AppState {
	readonly todos: readonly Todo[];
	readonly filter: Filter;
}

// --- Pure Functional State Reducers ---
export const createInitialState = (): AppState => ({
	todos: [],
	filter: "all",
});

export const addTodo = (state: AppState, text: string): AppState => {
	const trimmed = text.trim();
	if (!trimmed) return state;

	return {
		...state,
		todos: [
			...state.todos,
			{
				id: crypto.randomUUID(),
				text: trimmed,
				completed: false,
			},
		],
	};
};

export const toggleTodo = (state: AppState, id: string): AppState => ({
	...state,
	todos: state.todos.map((t) =>
		t.id === id ? { ...t, completed: !t.completed } : t,
	),
});

export const deleteTodo = (state: AppState, id: string): AppState => ({
	...state,
	todos: state.todos.filter((t) => t.id !== id),
});

export const clearCompleted = (state: AppState): AppState => ({
	...state,
	todos: state.todos.filter((t) => !t.completed),
});

export const setFilter = (state: AppState, filter: Filter): AppState => ({
	...state,
	filter,
});

export const getFilteredTodos = (
	todos: readonly Todo[],
	filter: Filter,
): readonly Todo[] => {
	if (filter === "active") return todos.filter((t) => !t.completed);
	if (filter === "completed") return todos.filter((t) => t.completed);
	return todos;
};

// --- Functional Component Views ---
const Header = () => `
  <header class="text-center mb-8">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold mb-3 tracking-wide uppercase">
      <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
      BunVite Live Engine
    </div>
    <h1 class="text-4xl font-extrabold tracking-tight bg-linear-to-r from-rose-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
      Bun Todos
    </h1>
    <p class="text-slate-400 text-sm mt-1">Functional & Component-Driven Architecture</p>
  </header>
`;

const TodoItem = (todo: Todo) => `
  <li class="todo-item flex items-center justify-between p-4 border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors group ${todo.completed ? "completed" : ""}" data-id="${todo.id}">
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <input
        type="checkbox"
        class="todo-checkbox w-5 h-5 accent-rose-500 rounded cursor-pointer"
        data-action="toggle"
        ${todo.completed ? "checked" : ""}
      />
      <span class="todo-text text-base wrap-break-word flex-1 transition-all ${todo.completed ? "text-slate-500 line-through" : "text-slate-200"}">
        ${todo.text}
      </span>
    </div>
    <button
      type="button"
      class="delete-btn opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-500 hover:text-red-400 text-sm px-2 py-1 transition-all cursor-pointer"
      data-action="delete"
      title="Delete task"
    >
      ✕
    </button>
  </li>
`;

const TodoList = (todos: readonly Todo[]) => {
	if (todos.length === 0) {
		return `
      <ul id="todo-list" class="divide-y divide-slate-800/80 max-h-96 overflow-y-auto"></ul>
      <div id="empty-state" class="py-12 px-4 text-center text-slate-500 text-sm">
        <svg aria-hidden="true" class="w-10 h-10 mx-auto text-slate-600 mb-2 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        No tasks yet. Add one above!
      </div>
    `;
	}

	return `
    <ul id="todo-list" class="divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
      ${todos.map(TodoItem).join("")}
    </ul>
    <div id="empty-state" class="hidden"></div>
  `;
};

const Footer = (activeCount: number, currentFilter: Filter) => {
	const btnClass = (filter: Filter) =>
		filter === currentFilter
			? "bg-rose-500/20 text-rose-400 font-semibold"
			: "text-slate-400 hover:text-slate-200";

	return `
    <span id="todo-count" class="font-medium">${activeCount} ${activeCount === 1 ? "item left" : "items left"}</span>
    <div class="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
      <button type="button" id="filter-all" data-filter="all" class="filter-btn px-2.5 py-1 rounded-md transition-colors cursor-pointer ${btnClass("all")}">All</button>
      <button type="button" id="filter-active" data-filter="active" class="filter-btn px-2.5 py-1 rounded-md transition-colors cursor-pointer ${btnClass("active")}">Active</button>
      <button type="button" id="filter-completed" data-filter="completed" class="filter-btn px-2.5 py-1 rounded-md transition-colors cursor-pointer ${btnClass("completed")}">Completed</button>
    </div>
    <button type="button" id="clear-completed-btn" class="hover:text-rose-400 transition-colors cursor-pointer">
      Clear completed
    </button>
  `;
};

// --- App Store & Component Mount ---
export const createApp = (
	root: HTMLElement,
	initialState = createInitialState(),
) => {
	let state = initialState;

	// Mount root layout once
	root.className = "w-full max-w-lg";
	root.innerHTML = `
    ${Header()}
    <main class="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden ring-1 ring-white/5">
      <form id="todo-form" class="flex gap-2 p-4 border-b border-slate-800 bg-slate-900/50">
        <input
          type="text"
          id="todo-input"
          placeholder="What needs to be done?"
          autocomplete="off"
          class="flex-1 bg-slate-950/80 border border-slate-700/70 focus:border-rose-500 text-slate-100 placeholder-slate-500 text-sm rounded-xl px-4 py-3 focus:outline-hidden transition-all"
        />
        <button
          type="submit"
          id="add-todo-btn"
          class="bg-linear-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg shadow-rose-500/25 active:scale-95 transition-all cursor-pointer"
        >
          Add
        </button>
      </form>
      <div id="todo-list-container"></div>
      <footer id="todo-footer" class="flex items-center justify-between px-4 py-3 bg-slate-950/60 border-t border-slate-800/80 text-xs text-slate-400"></footer>
    </main>
  `;

	const inputEl = root.querySelector("#todo-input") as HTMLInputElement;
	const formEl = root.querySelector("#todo-form") as HTMLFormElement;
	const listContainer = root.querySelector(
		"#todo-list-container",
	) as HTMLDivElement;
	const footerContainer = root.querySelector("#todo-footer") as HTMLElement;

	// Pure dynamic render function
	const render = () => {
		const visibleTodos = getFilteredTodos(state.todos, state.filter);
		const activeCount = state.todos.filter((t) => !t.completed).length;

		listContainer.innerHTML = TodoList(visibleTodos);
		footerContainer.innerHTML = Footer(activeCount, state.filter);
	};

	const dispatch = (action: (s: AppState) => AppState) => {
		state = action(state);
		render();
	};

	// Event handlers
	formEl.addEventListener("submit", (e) => {
		e.preventDefault();
		if (inputEl.value.trim()) {
			dispatch((s) => addTodo(s, inputEl.value));
			inputEl.value = "";
		}
	});

	root.addEventListener("click", (e) => {
		const target = e.target as HTMLElement;

		// Filters
		const filter = target.dataset.filter as Filter | undefined;
		if (filter) {
			dispatch((s) => setFilter(s, filter));
			return;
		}

		// Clear completed
		if (target.id === "clear-completed-btn") {
			dispatch(clearCompleted);
			return;
		}

		// Delete item
		const itemEl = target.closest<HTMLLIElement>(".todo-item");
		const id = itemEl?.dataset.id;
		if (id && target.dataset.action === "delete") {
			dispatch((s) => deleteTodo(s, id));
		}
	});

	root.addEventListener("change", (e) => {
		const target = e.target as HTMLInputElement;
		if (target.dataset.action === "toggle") {
			const itemEl = target.closest<HTMLLIElement>(".todo-item");
			const id = itemEl?.dataset.id;
			if (id) {
				dispatch((s) => toggleTodo(s, id));
			}
		}
	});

	// Initial render
	render();

	return {
		getState: () => state,
		dispatch,
	};
};

// Auto-mount
if (typeof document !== "undefined") {
	const mountEl = document.getElementById("app");
	if (mountEl) {
		(window as unknown as { app: ReturnType<typeof createApp> }).app =
			createApp(mountEl);
	}
}
