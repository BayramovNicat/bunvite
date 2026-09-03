export type Filter = "all" | "active" | "completed";

export interface Todo {
	id: string;
	text: string;
	completed: boolean;
}

export interface AppState {
	todos: Todo[];
	filter: Filter;
}

const Check = /*svg*/ `<svg class="size-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const Close = /*svg*/ `<svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const Plus = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;

const root = document.querySelector("#app") as HTMLElement;

const state: AppState = { todos: [], filter: "all" };

root.className = "w-full max-w-90";
root.innerHTML = /*html*/ `
		<div class="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-sm">
			<header class="flex items-center justify-between px-5 pt-5 pb-4"></header>
			<div class="px-4 pb-4">
				<form id="todo-form" class="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-all duration-150">
					<input id="todo-input" name="task" placeholder="Add a task..." autocomplete="off" class="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden" />
					<button type="submit" class="text-zinc-600 hover:text-indigo-400 transition-colors cursor-pointer">${Plus}</button>
				</form>
			</div>
			<ul class="divide-y divide-zinc-800/60 border-t border-zinc-800/60"></ul>
			<footer class="flex items-center justify-between px-5 py-3 border-t border-zinc-800/60"></footer>
		</div>
	`;

const [header, list, footer] = [
	root.querySelector("header") as HTMLElement,
	root.querySelector("ul") as HTMLElement,
	root.querySelector("footer") as HTMLElement,
];
const form = root.querySelector("#todo-form") as HTMLFormElement;

const render = () => {
	const visible = state.todos.filter((t) =>
		state.filter === "active" ? !t.completed : state.filter === "completed" ? t.completed : true,
	);
	const active = state.todos.filter((t) => !t.completed).length;

	header.innerHTML = /*html*/ `
			<h1 class="text-base font-semibold text-zinc-100 tracking-tight">Tasks</h1>
			${state.todos.length ? /*html*/ `<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">${state.todos.length}</span>` : ""}
		`;

	list.innerHTML = visible.length
		? visible
				.map(
					(t) => /*html*/ `
				<li class="todo-item group flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors" data-id="${t.id}">
					<button type="button" data-action="toggle" class="shrink-0 size-4.5 rounded-full border transition-all cursor-pointer flex items-center justify-center ${t.completed ? "bg-indigo-500 border-indigo-500" : "border-zinc-600 hover:border-zinc-400 bg-transparent"}">
						${t.completed ? Check : ""}
					</button>
					<span class="todo-text flex-1 text-sm leading-relaxed select-none transition-colors cursor-pointer ${t.completed ? "line-through text-zinc-600" : "text-zinc-200"}" data-action="toggle">${t.text}</span>
					<button type="button" data-action="delete" class="delete-btn opacity-0 group-hover:opacity-100 size-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all cursor-pointer">${Close}</button>
				</li>
			`,
				)
				.join("")
		: /*html*/ `<p class="text-zinc-600 text-xs text-center py-8">No tasks here</p>`;

	footer.innerHTML = /*html*/ `
			<span class="text-xs text-zinc-600">${active} remaining</span>
			<div class="flex items-center gap-0.5">
				${(["all", "active", "completed"] as const)
					.map(
						(f) => /*html*/ `
					<button type="button" data-filter="${f}" class="text-xs px-3 py-1 rounded-full transition-all cursor-pointer capitalize ${state.filter === f ? "bg-indigo-500/20 text-indigo-400 font-medium" : "text-zinc-500 hover:text-zinc-300"}">${f === "completed" ? "Done" : f}</button>
				`,
					)
					.join("")}
			</div>
			<button type="button" id="clear-btn" data-action="clear" class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer">Clear</button>
		`;
};

form.onsubmit = (e) => {
	e.preventDefault();
	const text = (form.elements.namedItem("task") as HTMLInputElement).value.trim();
	if (!text) return;
	state.todos.push({ id: crypto.randomUUID(), text, completed: false });
	form.reset();
	render();
};

root.onclick = (e) => {
	const el = (e.target as HTMLElement).closest<HTMLElement>("[data-action], [data-filter]");
	if (!el) return;

	const { action, filter } = el.dataset;
	const id = el.closest<HTMLElement>("[data-id]")?.dataset.id;
	const item = state.todos.find((t) => t.id === id);

	if (filter) state.filter = filter as Filter;
	else if (action === "clear") state.todos = state.todos.filter((t) => !t.completed);
	else if (action === "toggle" && item) item.completed = !item.completed;
	else if (action === "delete" && id) state.todos = state.todos.filter((t) => t.id !== id);
	else return;

	render();
};

render();
