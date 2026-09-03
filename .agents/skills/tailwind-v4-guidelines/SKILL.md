---
name: tailwind-v4-guidelines
description: >-
  Comprehensive guide and strict rules for Tailwind CSS v4. Prevents legacy v3 class patterns,
  deprecated utilities, incorrect sizing/dimension usage, old opacity helpers, and legacy syntax.
  Use when writing, refactoring, or reviewing HTML, CSS, React/Vue/Svelte, JSX/TSX, and TypeScript files with Tailwind classes.
---

# Complete Tailwind CSS v4 Class & Migration Reference

This skill provides an exhaustive mapping of **all Tailwind CSS v4 syntax, utility renames, sizing conventions, and modern CSS-first rules**. It prevents outdated Tailwind v3 patterns from being used in any component or template.

---

## 1. Complete Utility Class Renames (v3 ➔ v4)

### 🌈 Gradients & Color Interpolation
Linear gradients in v4 match the standard CSS `linear-gradient()` naming convention:

| ❌ Legacy / Deprecated (v3) | ✅ Modern Canonical (v4) | CSS Output / Notes |
| :--- | :--- | :--- |
| `bg-gradient-to-r` | `bg-linear-to-r` | `linear-gradient(to right, ...)` |
| `bg-gradient-to-l` | `bg-linear-to-l` | `linear-gradient(to left, ...)` |
| `bg-gradient-to-t` | `bg-linear-to-t` | `linear-gradient(to top, ...)` |
| `bg-gradient-to-b` | `bg-linear-to-b` | `linear-gradient(to bottom, ...)` |
| `bg-gradient-to-tr` | `bg-linear-to-tr` | `linear-gradient(to top right, ...)` |
| `bg-gradient-to-tl` | `bg-linear-to-tl` | `linear-gradient(to top left, ...)` |
| `bg-gradient-to-br` | `bg-linear-to-br` | `linear-gradient(to bottom right, ...)` |
| `bg-gradient-to-bl` | `bg-linear-to-bl` | `linear-gradient(to bottom left, ...)` |
| `bg-gradient-to-*` | `bg-linear-to-*` | Directional linear gradient |
| *(arbitrary degree)* | `bg-linear-45`, `bg-linear-135` | Angle-based linear gradients |
| *(new)* | `bg-radial`, `bg-radial-[...]` | Native radial gradients |
| *(new)* | `bg-conic`, `bg-conic-[...]` | Native conic gradients |

---

### 📏 Sizing, Dimensions & Pixels (`w-*`, `h-*`, `size-*`)

In v4, sizing is unified with the dynamic spacing scale and new dedicated dimension utilities:

| Use Case | ❌ Outdated / Verbose Pattern | ✅ Modern Canonical (v4) | Details |
| :--- | :--- | :--- | :--- |
| **Square Width + Height** | `w-5 h-5`, `w-12 h-12` | `size-5`, `size-12` | Sets both `width` & `height` in a single utility |
| **Full Square Size** | `w-full h-full` | `size-full` | Sets `width: 100%; height: 100%` |
| **Pixel Square Size** | `w-px h-px` | `size-px` | Sets `width: 1px; height: 1px` |
| **Arbitrary Square** | `w-[50px] h-[50px]` | `size-[50px]` | Combined arbitrary dimension |
| **Dynamic Spacing** | `w-[68px]` *(when on scale)* | `w-17` | Sizing dynamically generates from `--spacing` (17 = 4.25rem) |
| **Dynamic Viewport Height** | `h-screen` *(mobile URL bar shifts)* | `h-dvh` *(dynamic)*, `h-svh`, `h-lvh` | Viewport height accounting for mobile toolbars |
| **Dynamic Viewport Width** | `w-screen` | `w-dvw`, `w-svw`, `w-lvw` | Dynamic viewport widths |
| **Logical Sizing** | *(custom CSS)* | `inline-full`, `block-full` | Modern logical property sizing (`inline-size`, `block-size`) |

---

### 🔤 Text Wrapping & Word Breaking
Tailwind v4 cleanly separates `overflow-wrap` and `word-break`:

| ❌ Legacy / Ambiguous (v3) | ✅ Modern Canonical (v4) | CSS Property |
| :--- | :--- | :--- |
| `break-words` | `wrap-break-word` | `overflow-wrap: break-word` |
| `break-words` *(anywhere)* | `wrap-anywhere` | `overflow-wrap: anywhere` |
| `break-all` | `break-all` | `word-break: break-all` |
| `overflow-ellipsis` | `text-ellipsis` | `text-overflow: ellipsis` |
| `overflow-clip` | `text-clip` | `text-overflow: clip` |

---

### 📐 Flexbox, Grid & Layout

| ❌ Legacy (v3) | ✅ Modern Canonical (v4) | Notes |
| :--- | :--- | :--- |
| `flex-grow` | `grow` | `flex-grow: 1` |
| `flex-grow-0` | `grow-0` | `flex-grow: 0` |
| `flex-shrink` | `shrink` | `flex-shrink: 1` |
| `flex-shrink-0` | `shrink-0` | `flex-shrink: 0` |
| `decoration-slice` | `box-decoration-slice` | Full CSS property name |
| `decoration-clone` | `box-decoration-clone` | Full CSS property name |
| *(new)* | `grid-cols-subgrid`, `grid-rows-subgrid` | CSS Subgrid support |

---

### 🎯 Outlines, Focus & Rings

| ❌ Legacy (v3) | ✅ Modern Canonical (v4) | Notes |
| :--- | :--- | :--- |
| `outline-none` *(hiding focus)* | `outline-hidden` / `focus:outline-hidden` | Hides default browser focus outline (`outline: 2px solid transparent;`) |
| `outline-none` *(in v4)* | `outline-none` | Sets `outline-style: none` |
| *(new)* | `inset-ring`, `inset-ring-1` | Native inner border ring without clipping |
| *(new)* | `inset-shadow-xs`, `inset-shadow-sm` | Native inner shadows |

---

### 🎨 Opacity & Color Slash Notation
Legacy separate `*-opacity-*` helper classes are completely removed in v4:

| ❌ Deprecated / Removed (v3) | ✅ Modern Canonical (v4) |
| :--- | :--- |
| `bg-rose-500 bg-opacity-20` | `bg-rose-500/20` |
| `text-slate-100 text-opacity-80` | `text-slate-100/80` |
| `border-slate-800 border-opacity-50` | `border-slate-800/50` |
| `ring-rose-500 ring-opacity-25` | `ring-rose-500/25` |
| `placeholder-slate-400 placeholder-opacity-60` | `placeholder-slate-400/60` |
| `divide-slate-700 divide-opacity-40` | `divide-slate-700/40` |

---

### 📦 Sizing Scale Shift (Shadows, Radii, Blurs)
Tailwind v4 adjusted default scales to ensure consistent named values:

| v3 Utility | v4 Equivalent | Notes |
| :--- | :--- | :--- |
| `shadow-sm` | `shadow-xs` | Sizing renamed to `-xs` |
| `shadow` | `shadow-sm` | Sizing renamed to `-sm` |
| `drop-shadow-sm` | `drop-shadow-xs` | Renamed to `-xs` |
| `drop-shadow` | `drop-shadow-sm` | Renamed to `-sm` |
| `blur-sm` | `blur-xs` | Renamed to `-xs` |
| `rounded-sm` | `rounded-xs` | Refined micro-radius |

---

### 🔄 3D Transforms (New in v4)
Tailwind v4 includes native 3D transform utilities:
* `transform-3d`, `transform-flat`
* `rotate-x-*`, `rotate-y-*`, `rotate-z-*`
* `scale-z-*`, `translate-z-*`
* `perspective-*` (`perspective-dramatic`, `perspective-near`, `perspective-normal`)
* `backface-visible`, `backface-hidden`

---

## 2. Configuration & Directives

### CSS-First Setup (`src/style.css`)
No `tailwind.config.js` or multiple `@tailwind` directives. Only:

```css
@import "tailwindcss";

@theme {
  --color-primary: #f43f5e;
  --font-sans: "Inter", sans-serif;
  --spacing-container: 32rem;
}
```

### Arbitrary Values
In arbitrary values with multiple tokens (like grid template columns), spaces are represented by **underscores (`_`)**:
* `grid-cols-[100px_1fr]` instead of `grid-cols-[100px,1fr]`.

---

## 3. Quick Checklist for Code Reviews

When generating or editing Tailwind classes, ensure:
1. **Gradients:** `bg-linear-to-*` used instead of `bg-gradient-to-*`.
2. **Squares:** `size-*` used instead of repetitive `w-* h-*`.
3. **Word Wrapping:** `wrap-break-word` or `wrap-anywhere` used instead of `break-words`.
4. **Flexbox:** `grow` and `shrink-0` used instead of `flex-grow` / `flex-shrink-0`.
5. **Outlines:** `outline-hidden` / `focus:outline-hidden` used to suppress default outlines.
6. **Colors/Opacity:** Slash notation (`bg-rose-500/20`) used instead of separate opacity classes.
7. **Viewport Heights:** `h-dvh` preferred over `h-screen` for mobile resilience.
