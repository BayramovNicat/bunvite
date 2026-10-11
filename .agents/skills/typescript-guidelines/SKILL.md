---
name: typescript-guidelines
description: >-
  Strict standards and architectural guidelines for writing clean, modular, and high-performance TypeScript and TSX code.
  Enforces component-based architecture using jsx-dom, direct type-safe event handlers, replaceChildren DOM rendering,
  native web platform capabilities, and zero boilerplate. Use when creating, refactoring, or reviewing any TypeScript/TSX code.
---

# TypeScript & TSX Component Guidelines

This skill defines the architectural standards for writing clean, modular, and high-performance TypeScript and TSX applications in this workspace.

---

## 1. Core Philosophy: Zero-Virtual-DOM TSX

BunVite is configured with `"jsx": "react-jsx"` and `"jsxImportSource": "jsx-dom"` in `tsconfig.json`.

1. **Native DOM Elements Directly**:
   JSX expressions do not generate virtual DOM fibers or lightweight VNodes. They return real, native browser elements (`HTMLElement`, `SVGElement`, `DocumentFragment`) at runtime with zero diffing overhead.
2. **Component-Based UI**:
   Build interfaces using functional, composable components with typed props.
3. **Direct Type-Safe Event Handlers**:
   Use direct JSX event bindings (`onClick`, `onInput`, `onSubmit`, `onChange`) with native lexical closures. Never use string-based event delegation hacks (`data-action`, `.closest()`, `.dataset`).
4. **Safe Native DOM Swapping**:
   Mount and re-render using `root.replaceChildren(<App />)`. Never assign untyped HTML strings via `innerHTML`.
5. **Radical Simplicity**:
   Bypass Redux/Flux-style reducers, action creators, and artificial dispatch ceremonies. Mutate or update state directly and invoke `render()`.

---

## 2. Component-Based Architecture

Organize all application UI into pure, functional TSX components:

### 1. Component Structure & Typed Props
Declare explicit TypeScript interfaces for component props:

```tsx
interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TodoItem = ({ todo, onToggle, onDelete }: TodoItemProps) => (
  <li class="group flex items-center justify-between gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
    <button
      type="button"
      class="flex items-center gap-3 flex-1 text-left cursor-pointer"
      onClick={() => onToggle(todo.id)}
    >
      <span class={`size-5 rounded-md border flex items-center justify-center ${todo.completed ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-zinc-700'}`}>
        {todo.completed && <CheckIcon class="size-3.5" />}
      </span>
      <span class={`text-sm ${todo.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
        {todo.text}
      </span>
    </button>
    <button
      type="button"
      class="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-400 transition-opacity cursor-pointer"
      onClick={() => onDelete(todo.id)}
      title="Delete task"
    >
      <TrashIcon class="size-4" />
    </button>
  </li>
);
```

### 2. Composable Children
Accept `children` when building container or wrapper components:

```tsx
interface CardProps {
  title: string;
  badge?: string;
  children: JSX.Element | JSX.Element[] | string;
}

export const Card = ({ title, badge, children }: CardProps) => (
  <section class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
    <header class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-zinc-100">{title}</h2>
      {badge && (
        <span class="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20">
          {badge}
        </span>
      )}
    </header>
    <div class="space-y-3">{children}</div>
  </section>
);
```

### 3. List Rendering & Dynamic Mapping
Map arrays directly inside JSX expressions:

```tsx
interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TodoList = ({ todos, onToggle, onDelete }: TodoListProps) => {
  if (todos.length === 0) {
    return <p class="text-sm text-zinc-500 text-center py-8">No tasks yet.</p>;
  }

  return (
    <ul class="space-y-2">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </ul>
  );
};
```

---

## 3. DOM Mounting & Rendering Cycle

### 1. Direct Entry Mount
Query the root container at the top of `src/app.tsx`:

```tsx
const root = document.querySelector('#app') as HTMLElement;
```

### 2. Atomic Reconciliation via `replaceChildren`
Use `root.replaceChildren(<App />)` to update the view:

```tsx
// ❌ Dangerous & slow (string parsing, event loss, XSS vulnerability):
root.innerHTML = `<div class="card">...</div>`;

// ✅ Native, safe, and instantaneous (replaces with native DOM tree):
const render = () => {
  root.replaceChildren(<App />);
};
```

---

## 4. State Management & HMR State Preservation

### 1. Top-Level State Object
Define application state as a plain object at module scope. BunVite automatically preserves this object across module hot-reloads via `(window.__hmr_state__ ??= ...)`:

```tsx
interface AppState {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
}

const state: AppState = {
  todos: [],
  filter: 'all',
};
```

### 2. Direct Mutation + Re-render
Keep state updates simple and direct:

```tsx
const addTodo = (text: string) => {
  state.todos.push({
    id: crypto.randomUUID(),
    text,
    completed: false,
  });
  render();
};

const toggleTodo = (id: string) => {
  const item = state.todos.find((t) => t.id === id);
  if (item) {
    item.completed = !item.completed;
    render();
  }
};

const deleteTodo = (id: string) => {
  state.todos = state.todos.filter((t) => t.id !== id);
  render();
};
```

---

## 5. Native Platform & Form Handling

Always leverage native browser capabilities rather than custom workarounds:

### 1. Native Form Submission & `reset()`
Use standard `<form onSubmit={...}>` handlers with `event.currentTarget.reset()`:

```tsx
interface AddTodoFormProps {
  onAdd: (text: string) => void;
}

export const AddTodoForm = ({ onAdd }: AddTodoFormProps) => {
  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.elements.namedItem('task') as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;

    onAdd(text);
    form.reset();
  };

  return (
    <form onSubmit={handleSubmit} class="flex items-center gap-2">
      <input
        id="new-task-input"
        name="task"
        type="text"
        placeholder="Add a new task..."
        autocomplete="off"
        class="flex-1 px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
      />
      <button
        type="submit"
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-medium rounded-xl transition-all cursor-pointer"
      >
        Add
      </button>
    </form>
  );
};
```

### 2. Native Property Names
- In `jsx-dom`, both `class="..."` and `className="..."` are supported. Prefer `class="..."` for clean alignment with standard HTML and Tailwind CSS v4.
- Use native boolean attributes (`disabled={isDisabled}`, `checked={isChecked}`).

---

## 6. SVG Icons as TSX Components

Do not use raw strings, `innerHTML`, or external icon fonts. Create pure, typed functional SVG components:

```tsx
interface IconProps {
  class?: string;
}

export const CheckIcon = ({ class: className = 'size-4' }: IconProps) => (
  <svg class={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const TrashIcon = ({ class: className = 'size-4' }: IconProps) => (
  <svg class={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);
```

---

## 7. DOM Hygiene: Minimal ID Usage

Never clutter markup with arbitrary container IDs.

### Rules:
1. **BANNED: Container IDs:**
   Do not use `id=` for styling, container markers, or layout regions:
   - ❌ `<div id="todo-list-container">`
   - ❌ `<div id="todo-footer">`
   - ❌ `<section id="hero-box">`
2. **REQUIRED: Semantic HTML:**
   Use semantic tags instead:
   - `<header>`, `<main>`, `<section>`, `<article>`, `<nav>`, `<ul>`, `<footer>`
3. **ONLY PERMITTED IDs:**
   - Root mounting point: `<div id="app"></div>`
   - Form inputs with explicit accessible labels: `<input id="search-input" />`
   - Specific test targets when asserted in automated integration tests: e.g. `<span id="counter">`

---

## 8. Review Checklist

When writing, refactoring, or reviewing TypeScript/TSX code:

1. [ ] **TSX Components:** Are UI elements written as functional TSX components returning native DOM elements?
2. [ ] **Typed Props:** Do components have explicit TypeScript interfaces for props?
3. [ ] **No `innerHTML`:** Is `root.replaceChildren(<App />)` used instead of `innerHTML`?
4. [ ] **Direct Handlers:** Are event handlers bound directly on JSX elements (`onClick={...}`) rather than via string `data-action` delegation?
5. [ ] **Native Forms:** Are forms submitted via `onSubmit` and reset with `form.reset()`?
6. [ ] **Zero Container IDs:** Are layout divs free of arbitrary `id=` attributes?
7. [ ] **Typed SVG Icons:** Are icons created as functional TSX components with customizable `class` props?
8. [ ] **2-Space Indentation:** Is all code formatted with 2-space indentation matching project Biome rules?
