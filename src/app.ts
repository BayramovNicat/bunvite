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

export const createInitialState = (): AppState => ({ todos: [], filter: "all" });

export const addTodo = (state: AppState, text: string): AppState => {
	const trimmed = text.trim();
	if (!trimmed) return state;
	return {
		...state,
		todos: [...state.todos, { id: crypto.randomUUID(), text: trimmed, completed: false }],
	};
};

export const toggleTodo = (state: AppState, id: string): AppState => ({
	...state,
	todos: state.todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
});

export const deleteTodo = (state: AppState, id: string): AppState => ({
	...state,
	todos: state.todos.filter((t) => t.id !== id),
});

export const clearCompleted = (state: AppState): AppState => ({
	...state,
	todos: state.todos.filter((t) => !t.completed),
});

export const setFilter = (state: AppState, filter: Filter): AppState => ({ ...state, filter });

export const getFilteredTodos = (todos: readonly Todo[], filter: Filter): readonly Todo[] => {
	if (filter === "active") return todos.filter((t) => !t.completed);
	if (filter === "completed") return todos.filter((t) => t.completed);
	return todos;
};

const CheckIcon = () =>
	/*svg*/ `<svg class="size-3 pointer-events-none" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5,6 4.5,9 10.5,3"/></svg>`;

const TodoItem = (todo: Todo) => /*html*/ `
	<li class="todo-item group flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors" data-id="${todo.id}">
		<button
			type="button"
			data-action="toggle"
			class="shrink-0 size-4.5 rounded-full border transition-all duration-150 cursor-pointer flex items-center justify-center
				${todo.completed ? "bg-indigo-500 border-indigo-500" : "border-zinc-600 hover:border-zinc-400 bg-transparent"}"
		>
			${todo.completed ? CheckIcon() : ""}
		</button>
		<span
			class="todo-text flex-1 text-sm leading-relaxed select-none transition-colors duration-150 cursor-pointer
				${todo.completed ? "line-through text-zinc-600" : "text-zinc-200"}"
			data-action="toggle"
		>${todo.text}</span>
		<button
			type="button"
			data-action="delete"
			class="delete-btn opacity-0 group-hover:opacity-100 size-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all cursor-pointer"
		>
			<svg class="size-3 pointer-events-none" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
		</button>
	</li>
`;

const FilterBtn = (label: string, value: Filter, current: Filter) => {
	const active = value === current;
	return /*html*/ `<button type="button" data-filter="${value}" class="filter-btn text-xs px-3 py-1 rounded-full transition-all duration-150 cursor-pointer
		${active ? "bg-indigo-500/20 text-indigo-400 font-medium" : "text-zinc-500 hover:text-zinc-300"}">${label}</button>`;
};

export const createApp = (root: HTMLElement, initialState = createInitialState()) => {
	let state = initialState;
	const controller = new AbortController();
	const { signal } = controller;

	root.className = "w-full max-w-[360px]";
	root.innerHTML = /*html*/ `
		<div class="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-sm">
			<div class="flex items-center justify-between px-5 pt-5 pb-4">
				<h1 class="text-base font-semibold text-zinc-100 tracking-tight bg-cyan-900">Tasks</h1>
				<span id="task-badge" class="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400"></span>
			</div>

			<div class="px-4 pb-4">
				<form id="todo-form" class="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-all duration-150">
					<input
						type="text"
						id="todo-input"
						placeholder="Add a task..."
						autocomplete="off"
						class="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden"
					/>
					<button type="submit" class="text-zinc-600 hover:text-indigo-400 transition-colors cursor-pointer">
						<svg class="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>
					</button>
				</form>
			</div>

			<div id="todo-list-container" class="border-t border-zinc-800/60"></div>

			<div id="todo-footer" class="flex items-center justify-between px-5 py-3 border-t border-zinc-800/60"></div>
		</div>
	`;

	const inputEl = root.querySelector("#todo-input") as HTMLInputElement;
	const formEl = root.querySelector("#todo-form") as HTMLFormElement;
	const listContainer = root.querySelector("#todo-list-container") as HTMLDivElement;
	const footerEl = root.querySelector("#todo-footer") as HTMLDivElement;
	const badgeEl = root.querySelector("#task-badge") as HTMLSpanElement;

	const render = () => {
		const visible = getFilteredTodos(state.todos, state.filter);
		const activeCount = state.todos.filter((t) => !t.completed).length;
		const total = state.todos.length;

		badgeEl.textContent = total > 0 ? String(total) : "";
		badgeEl.style.display = total > 0 ? "" : "none";

		if (visible.length === 0) {
			listContainer.innerHTML = /*html*/ `<p class="text-zinc-600 text-xs text-center py-8">No tasks here</p>`;
		} else {
			listContainer.innerHTML = /*html*/ `<ul class="divide-y divide-zinc-800/60">${visible.map(TodoItem).join("")}</ul>`;
		}

		footerEl.innerHTML = /*html*/ `
			<span class="text-xs text-zinc-600">${activeCount} remaining</span>
			<div class="flex items-center gap-0.5">
				${FilterBtn("All", "all", state.filter)}
				${FilterBtn("Active", "active", state.filter)}
				${FilterBtn("Done", "completed", state.filter)}
			</div>
			<button type="button" id="clear-btn" class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer">Clear</button>
		`;
	};

	const dispatch = (action: (s: AppState) => AppState) => {
		state = action(state);
		render();
	};

	formEl.addEventListener(
		"submit",
		(e) => {
			e.preventDefault();
			if (inputEl.value.trim()) {
				dispatch((s) => addTodo(s, inputEl.value));
				inputEl.value = "";
			}
		},
		{ signal },
	);

	root.addEventListener(
		"click",
		(e) => {
			const target = e.target as HTMLElement;

			const filter = target.dataset.filter as Filter | undefined;
			if (filter) return dispatch((s) => setFilter(s, filter));

			if (target.id === "clear-btn") return dispatch(clearCompleted);

			const itemEl = target.closest<HTMLLIElement>(".todo-item");
			const id = itemEl?.dataset.id;
			if (!id) return;

			if (target.dataset.action === "toggle") dispatch((s) => toggleTodo(s, id));
			if (target.dataset.action === "delete") dispatch((s) => deleteTodo(s, id));
		},
		{ signal },
	);

	render();

	return {
		getState: () => state,
		dispatch,
		destroy: () => controller.abort(),
	};
};

if (typeof document !== "undefined") {
	const mountEl = document.getElementById("app");
	const appObj = (window as unknown as { app?: { getState?: () => AppState } }).app;
	if (mountEl && typeof appObj?.getState !== "function") {
		(window as unknown as { app: ReturnType<typeof createApp> }).app = createApp(mountEl);
	}
}
