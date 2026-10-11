---
name: inline-html-guidelines
description: >-
  Strict guidelines and standards for using /*html*/, /*css*/, and /*svg*/ language injection tags
  on template literals in TypeScript/JavaScript for VS Code syntax highlighting, Emmet, IntelliSense, and Prettier formatting.
---

# Inline HTML & Template Literal Injection Guidelines

This skill defines rules for using **language injection comment tags** (`/*html*/`, `/*css*/`, `/*svg*/`) on ES6 template literals in TypeScript and JavaScript files.

It targets the [Inline HTML](https://marketplace.visualstudio.com/items?itemName=pushqrdx.inline-html) VS Code extension (`pushqrdx.inline-html`) and standard Prettier inline HTML formatters.

> [!IMPORTANT]
> **Application UI Components Use TSX:**
> In this workspace, client application components must be written as **TSX (`.tsx`)** functional components powered by `jsx-dom` (see `typescript-guidelines`).
> Use `/*html*/`, `/*css*/`, and `/*svg*/` comment injection tags specifically for **raw string template literals**, such as:
> - Server/bundler engine scripts (e.g., `HMR_CLIENT_SCRIPT` in `vite.ts`)
> - Injected `<style>` blocks or runtime CSS template strings
> - Backend HTML string generation or test fixtures
>
> Never use raw template strings with `innerHTML` for client application UI components.

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
// ✅ Correct (server/engine script or template):
const HMR_CLIENT_SCRIPT = /*html*/ `
  <script>
    console.log("HMR connected");
  </script>
`;

// ✅ Correct (dynamic CSS):
const resetStyles = /*css*/ `
  *, ::before, ::after { box-sizing: border-box; }
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
| `/*html*/` | Server HTML templates, engine scripts, fixtures | Highlighting, Emmet, tag completion, Prettier formatting |
| `/*css*/` | Injected `<style>` blocks, dynamic stylesheets | CSS autocomplete, property validation, formatting |
| `/*svg*/` | Raw XML/SVG template strings | XML/SVG syntax coloring and attribute completion |
| `/*sql*/` | Database queries | SQL syntax highlighting |

---

## 4. Relationship with Comment Guidelines

As defined in `code-comments-guidelines`:
- `/*html*/`, `/*css*/`, and `/*svg*/` are **Tooling Directives / Language Injection Annotations**.
- They are **NOT** decorative, narrative, or non-useful comments.
- They are **explicitly permitted** and recommended on multiline HTML, CSS, and SVG template literals.

---

## 5. Checklist for Raw Template Strings

When writing raw HTML/CSS template strings (in server, engine, or fixture code):

1. [ ] **Tag all HTML template strings:** Prepend `/*html*/ ` directly before the opening backtick of any raw HTML markup literal.
2. [ ] **Tag CSS template strings:** Prepend `/*css*/ ` directly before CSS string templates.
3. [ ] **App UI uses TSX:** Ensure client UI components are built in `.tsx` using native `jsx-dom` components, not raw `/*html*/` strings.
