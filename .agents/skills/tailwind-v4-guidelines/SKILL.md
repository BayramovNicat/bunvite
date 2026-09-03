---
name: tailwind-v4-guidelines
description: >-
  Enforces correct and modern Tailwind CSS v4 class usage, preventing deprecated or legacy v3 class patterns.
  Use when creating, editing, refactoring, or reviewing HTML, CSS, React/Vue/Svelte components, or TypeScript files with Tailwind classes.
---

# Tailwind CSS v4 Class & Syntax Guidelines

This skill enforces modern **Tailwind CSS v4** syntax and utility classes, ensuring that legacy v3 patterns (e.g. `bg-gradient-to-*`, `break-words`, `flex-grow`, `bg-opacity-*`) are automatically replaced with their canonical v4 equivalents.

---

## 1. High-Priority Class Renames (v3 $\rightarrow$ v4)

### Gradients
In Tailwind v4, gradients match CSS property naming (`linear-gradient` $\rightarrow$ `bg-linear-to-*`).

| ❌ Legacy / Deprecated (v3) | ✅ Modern Canonical (v4) | Notes |
| :--- | :--- | :--- |
| `bg-gradient-to-r` | `bg-linear-to-r` | Linear gradient to right |
| `bg-gradient-to-l` | `bg-linear-to-l` | Linear gradient to left |
| `bg-gradient-to-t` | `bg-linear-to-t` | Linear gradient to top |
| `bg-gradient-to-b` | `bg-linear-to-b` | Linear gradient to bottom |
| `bg-gradient-to-tr` | `bg-linear-to-tr` | Linear gradient to top-right |
| `bg-gradient-to-tl` | `bg-linear-to-tl` | Linear gradient to top-left |
| `bg-gradient-to-br` | `bg-linear-to-br` | Linear gradient to bottom-right |
| `bg-gradient-to-bl` | `bg-linear-to-bl` | Linear gradient to bottom-left |
| `bg-gradient-to-*` | `bg-linear-to-*` | General linear gradient |
| *(new in v4)* | `bg-radial-*`, `bg-radial-[...]` | Radial gradient support |
| *(new in v4)* | `bg-conic-*`, `bg-conic-[...]` | Conic gradient support |

---

### Text Wrapping & Word Breaking
In Tailwind v4, `overflow-wrap` and `word-break` utilities are strictly separated for clarity.

| ❌ Legacy / Ambiguous (v3) | ✅ Modern Canonical (v4) | CSS Property Applied |
| :--- | :--- | :--- |
| `break-words` | `wrap-break-word` | `overflow-wrap: break-word` |
| `break-words` *(anywhere)* | `wrap-anywhere` | `overflow-wrap: anywhere` |
| `truncate` | `truncate` | Kept for text overflow ellipsis |
| `overflow-ellipsis` | `text-ellipsis` | `text-overflow: ellipsis` |
| `overflow-clip` | `text-clip` | `text-overflow: clip` |

---

### Flexbox & Layout
Single-word utilities replace legacy compound names.

| ❌ Legacy / Deprecated (v3) | ✅ Modern Canonical (v4) | Notes |
| :--- | :--- | :--- |
| `flex-grow` | `grow` | `flex-grow: 1` |
| `flex-grow-0` | `grow-0` | `flex-grow: 0` |
| `flex-shrink` | `shrink` | `flex-shrink: 1` |
| `flex-shrink-0` | `shrink-0` | `flex-shrink: 0` |
| `decoration-slice` | `box-decoration-slice` | `box-decoration-break: slice` |
| `decoration-clone` | `box-decoration-clone` | `box-decoration-break: clone` |

---

### Outlines & Focus Rings

| ❌ Legacy / Deprecated (v3) | ✅ Modern Canonical (v4) | Notes |
| :--- | :--- | :--- |
| `outline-none` | `outline-hidden` | Hides default browser focus outline (`outline: 2px solid transparent; outline-offset: 2px;`) |
| `focus:outline-none` | `focus:outline-hidden` | Use when custom focus rings/borders are applied |

---

### Opacity & Color Slash Notation
Legacy `*-opacity-*` helper classes are removed in v4 in favor of native alpha modifier slash syntax.

| ❌ Legacy / Deprecated (v3) | ✅ Modern Canonical (v4) |
| :--- | :--- |
| `bg-rose-500 bg-opacity-20` | `bg-rose-500/20` |
| `text-slate-100 text-opacity-80` | `text-slate-100/80` |
| `border-slate-800 border-opacity-50` | `border-slate-800/50` |
| `ring-rose-500 ring-opacity-25` | `ring-rose-500/25` |
| `shadow-rose-500 shadow-opacity-30` | `shadow-rose-500/30` |

---

### Sizing & Scale Shifts

| Legacy (v3) | Modern (v4) | Details |
| :--- | :--- | :--- |
| `shadow-sm` | `shadow-xs` *(or `shadow-sm`)* | v4 added `shadow-2xs` and `shadow-xs` |
| `rounded-sm` | `rounded-xs` *(or `rounded-sm`)* | v4 refined micro-radii scale |
| `blur-sm` | `blur-xs` *(or `blur-sm`)* | v4 introduced fine-grained blur values |

---

## 2. Configuration & Directives in Tailwind v4

### CSS Entrypoint (`src/style.css`)
Tailwind v4 replaces `@tailwind base; @tailwind components; @tailwind utilities;` with a single direct import:

```css
@import "tailwindcss";
```

### Custom Themes & Tokens
Custom configuration moves out of `tailwind.config.js` into CSS `@theme` blocks:

```css
@import "tailwindcss";

@theme {
  --color-brand: #f43f5e;
  --font-display: "Cabinet Grotesk", sans-serif;
}
```

---

## 3. Checklist for Agent Code Generation

When generating or editing Tailwind classes, always verify:
1. Did I use `bg-linear-to-*` instead of `bg-gradient-to-*`?
2. Did I use `wrap-break-word` instead of `break-words`?
3. Did I use `grow` and `shrink-0` instead of `flex-grow` / `flex-shrink-0`?
4. Did I use `outline-hidden` / `focus:outline-hidden` instead of `outline-none`?
5. Did I use slash notation (`bg-rose-500/20`) instead of separate `bg-opacity-*` classes?
