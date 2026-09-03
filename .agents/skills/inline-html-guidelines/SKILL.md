---
name: inline-html-guidelines
description: >-
  Strict guidelines and standards for using /*html*/, /*css*/, and /*svg*/ language injection tags
  on template literals in TypeScript/JavaScript for VS Code syntax highlighting, Emmet, IntelliSense, and Prettier formatting.
---

# Inline HTML & Template Literal Injection Guidelines

This skill defines rules for using **language injection comment tags** (`/*html*/`, `/*css*/`, `/*svg*/`) on ES6 template literals in TypeScript and JavaScript files.

It targets the [Inline HTML](https://marketplace.visualstudio.com/items?itemName=pushqrdx.inline-html) VS Code extension (`pushqrdx.inline-html`) and standard Prettier inline HTML formatters.

---

## 1. Core Purpose & Benefits

Using `/*html*/` immediately preceding a template literal transforms raw strings into first-class HTML inside your editor with **zero runtime overhead**:

1. **Syntax Highlighting**: Full HTML syntax coloring within TypeScript files.
2. **IntelliSense & Autocomplete**: Tag and attribute completion for standard HTML5 elements and Tailwind classes.
3. **Emmet**: Expanding Emmet abbreviations (`div.flex.items-center>span`) directly inside template literals.
4. **Prettier Formatting**: Prettier automatically parses and formats HTML code inside strings tagged with `/*html*/`.
5. **Zero Bundler Overhead**: It is a pure comment; minifiers (`Bun.build`, esbuild, Terser) strip it completely in production.

---

## 2. Syntax Rules

### ✅ The Canonical Pattern
Place `/*html*/` immediately before the opening backtick with no intervening newlines:

```typescript
// ✅ Correct:
const TodoItem = (todo: Todo) => /*html*/ `
	<li class="todo-item flex items-center gap-3">
		<span class="text-sm text-zinc-200">${todo.text}</span>
	</li>
`;

// ✅ Correct (inlined assignment):
root.innerHTML = /*html*/ `
	<div class="max-w-md mx-auto p-4">
		<h1 class="text-lg font-semibold">Tasks</h1>
	</div>
`;
```

### ❌ Anti-Patterns to Avoid

```typescript
// ❌ Disconnected comment (fails extension parser):
/*html*/
const template = `<div>...</div>`;

// ❌ Spaces inside tag (some extensions only recognize exact lowercase without spaces):
const template = /* html */ `<div>...</div>`;

// ❌ Tagging non-HTML plain strings:
const key = /*html*/ `user_${id}`;

// ❌ Unnecessary runtime wrapper when comment tag suffices:
const html = String.raw; // Unneeded runtime wrapper
const template = html`<div>...</div>`;
```

---

## 3. Supported Language Tags

| Tag | Target Content | Supported Features |
| :--- | :--- | :--- |
| `/*html*/` | HTML templates, components, innerHTML | Highlighting, Emmet, tag completion, Prettier formatting |
| `/*css*/` | Injected `<style>` blocks, dynamic stylesheets | CSS autocomplete, property validation, formatting |
| `/*svg*/` | Standalone SVG markup, icons | XML/SVG syntax coloring and attribute completion |
| `/*sql*/` | Database queries | SQL syntax highlighting |

---

## 4. Relationship with Comment Guidelines

As defined in `code-comments-guidelines`:
- `/*html*/`, `/*css*/`, and `/*svg*/` are **Tooling Directives / Language Injection Annotations**.
- They are **NOT** decorative, narrative, or non-useful comments.
- They are **explicitly permitted** and recommended on all multiline HTML and SVG template literals across the codebase.

---

## 5. Checklist for Component Writing

When writing or refactoring functional HTML components:

1. [ ] **Tag all HTML template strings:** Prepend `/*html*/ ` directly before the opening backtick of any HTML markup literal.
2. [ ] **Tag SVG helper functions:** Prepend `/*svg*/ ` or `/*html*/ ` to inline SVG icons.
3. [ ] **Format consistency:** Ensure `bun run format` cleanly formats the internal HTML indentation.
