---
name: typescript-guidelines
description: >-
  Strict guidelines and standards for writing clean, minimal, and high-performance TypeScript and DOM applications.
  Enforces radical simplicity, zero boilerplate, leveraging native browser/Chrome capabilities, minimal ID usage,
  and clean event-driven component architectures. Use when creating, refactoring, or reviewing any TypeScript code.
---

# TypeScript & Vanilla Web Application Guidelines

This skill defines the architectural standards for writing clean, ultra-minimal, and high-performance TypeScript applications in this workspace.

---

## 1. Core Philosophy: Radical Simplicity

1. **Minimal Code > Over-Engineering:**
   * Write direct, readable, and compact code.
   * Eliminate layers of indirection (avoid fake Redux reducers, event buses, or multi-step dispatch ceremonies when standard array methods and direct updates achieve the goal in fewer lines).
2. **Native Platform First:**
   * Always prefer built-in browser and Chrome APIs over custom JavaScript workarounds.
3. **Zero Boilerplate:**
   * If a value does not need a function wrapper, make it a constant.
   * If a state update and render pass can be unified, do not decouple them into artificial layers.
4. **Direct Entry Mounting:**
   * Query the mount root (`const root = document.querySelector("#app");`) at the top and run application logic directly. Avoid unnecessary `function createApp()` wrapper ceremonies and defensive SSR checks in client-only entry scripts.

---

## 2. Leverage Native Browser Capabilities

Always check if the browser can do the job natively before writing custom logic:

### 1. Form Resetting
Use standard `form.reset()` instead of manually wiping input values:

```typescript
// ❌ Verbose / Manual:
inputEl.value = "";
inputEl.focus();

// ✅ Native & Minimal:
form.reset();
```

### 2. Form Element Access
Use form element naming instead of individual `querySelector` calls:

```html
<form id="todo-form">
	<input name="task" />
</form>
```

```typescript
// ❌ Redundant element query:
const input = form.querySelector("input") as HTMLInputElement;
const text = input.value.trim();

// ✅ Native Form Elements:
const text = (form.elements.namedItem("task") as HTMLInputElement).value.trim();
```

### 3. Native Property Handlers (`onsubmit`, `onclick`)
For root event delegation and forms, assigning directly to property handlers (`form.onsubmit = ...`, `root.onclick = ...`) automatically overwrites any previous handler on code reload, preventing duplicate listener buildup without needing `AbortController`:

```typescript
// ✅ Minimal & Self-Replacing:
form.onsubmit = (e) => {
	e.preventDefault();
	...
};

root.onclick = (e) => {
	const el = (e.target as HTMLElement).closest("[data-action]");
	...
};
```

---

## 3. DOM Hygiene: Minimal `id` Usage

Never litter markup with arbitrary IDs on container divs.

### Rules:
1. **BANNED: Container IDs:**
   Never use `id=` for styling, container markers, or layout regions:
   * ❌ `id="todo-list-container"`
   * ❌ `id="todo-footer"`
   * ❌ `id="task-badge"`
2. **REQUIRED: Semantic HTML & Data Attributes:**
   Use semantic tags and `data-*` attributes instead:
   * `<header>`, `<main>`, `<section>`, `<ul>`, `<footer>`
   * `data-action="toggle"`, `data-action="delete"`, `data-filter="active"`
3. **ONLY PERMITTED IDs:**
   * Root mounting points: `<div id="app"></div>`
   * Form inputs requiring explicit accessibility labels: `<input id="todo-input" />`

```typescript
// ❌ ID Soup:
root.innerHTML = `
	<div id="header-box">...</div>
	<div id="todo-list-container">...</div>
	<div id="todo-footer">...</div>
`;

// ✅ Semantic & Clean:
root.innerHTML = `
	<header class="...">...</header>
	<ul class="divide-y ...">...</ul>
	<footer class="...">...</footer>
`;
```

---

## 4. Component-Based Architecture

Organize UI into pure, functional template components:

### 1. Tag All Markup with `/*html*/` and `/*svg*/`
Always prepend `/*html*/` or `/*svg*/` immediately before opening backticks for editor syntax highlighting, Emmet, and Prettier formatting:

```typescript
const TodoItem = (t: Todo) => /*html*/ `
	<li class="todo-item group flex items-center gap-3" data-id="${t.id}">
		<span class="todo-text flex-1" data-action="toggle">${t.text}</span>
	</li>
`;
```

### 2. Static Assets as Constants
Do not wrap static SVG icons in functions. Use direct string constants:

```typescript
// ❌ Function wrapper overhead:
const CheckIcon = () => `<svg ...>...</svg>`;

// ✅ Direct constant:
const Check = /*svg*/ `<svg class="size-3 pointer-events-none" viewBox="0 0 12 12" ...>...</svg>`;
```

### 3. Dynamic Array Mapping
Render lists and options using inline `.map().join("")` rather than multi-step builders:

```typescript
// ✅ Clean, inline mapping:
const FilterTabs = (current: Filter) =>
	(["all", "active", "completed"] as const)
		.map(
			(f) => /*html*/ `
			<button type="button" data-filter="${f}" class="${f === current ? "active" : ""}">
				${f}
			</button>
		`,
		)
		.join("");
```

---

## 5. Unified Event Delegation & Reactive Updates

### 1. Flat Event Delegation
Attach **one** listener to the root container and route actions using `.closest()`:

```typescript
root.addEventListener(
	"click",
	(e) => {
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
	},
	{ signal: controller.signal },
);
```

### 2. Direct State Mutation + Render
Bypass Redux/Flux-style reducer boilerplate. Apply changes directly to state and trigger `render()`:

```typescript
// ❌ Over-engineered reducer ceremony:
export const addTodo = (state: AppState, text: string): AppState => ...
export const toggleTodo = (state: AppState, id: string): AppState => ...
const dispatch = (action: (s: AppState) => AppState) => {
	state = action(state);
	render();
};

// ✅ Direct, simple, minimal:
state.todos.push({ id: crypto.randomUUID(), text, completed: false });
render();
```

---

## 6. Review Checklist

When writing or reviewing TypeScript code:

1. [ ] **Minimal Lines:** Has unnecessary boilerplate (fake reducers, redundant wrapper functions) been eliminated?
2. [ ] **Native APIs:** Is `form.reset()` used instead of manual wipes? Are named elements used?
3. [ ] **No ID Clutter:** Are container divs free of arbitrary `id=` attributes? Are semantic tags used?
4. [ ] **Tooling Directives:** Are all HTML/SVG template literals tagged with `/*html*/` and `/*svg*/`?
5. [ ] **Clean Delegation:** Is event handling routed through a single flat `.closest("[data-action]")` listener?
6. [ ] **Clean Teardown:** Is `AbortController` used with `{ signal }` for listener lifecycle management?
