---
name: tailwind-v4-guidelines
description: >-
  Comprehensive guide and strict rules for Tailwind CSS v4. Prevents legacy v3 class patterns,
  deprecated utilities, incorrect sizing/dimension usage, old opacity helpers, and legacy syntax.
  Use when writing, refactoring, or reviewing HTML, CSS, React/Vue/Svelte, JSX/TSX, and TypeScript files with Tailwind classes.
---

# Complete Tailwind CSS v4 Class & Migration Reference

This skill provides an exhaustive mapping of all Tailwind CSS v4 syntax, utility renames, sizing conventions, and modern CSS-first rules. It prevents outdated Tailwind v3 patterns and arbitrary bracket anti-patterns from being used in any component or template.

---

## 1. Complete Utility Class Renames (v3 to v4)

### Gradients & Color Interpolation
Linear gradients in v4 match standard CSS `linear-gradient()` naming:

| Deprecated (v3) | Canonical (v4) | CSS Output / Notes |
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

### Sizing, Dimensions & Pixels (`w-*`, `h-*`, `size-*`, `max-w-*`)

In Tailwind CSS v4, the spacing scale is continuous and infinite, derived directly from `--spacing: 0.25rem` (`4px`).

#### The Global Pixel-to-Scale Law
Before writing an arbitrary pixel bracket (`[...px]`), apply this universal formula:

$$\text{Scale Token } N = \frac{\text{Target Pixels}}{4}$$

1. **Even Multiples of 4px ($\text{px} \pmod 4 = 0$):**
   * Always write `w-N`, `h-N`, `size-N`, `max-w-N`, `min-w-N`, `p-N`, `m-N`, `gap-N`.
   * **BANNED:** `[360px]`, `[320px]`, `[280px]`, `[140px]`, `[68px]`, `[48px]`, `[40px]`
   * **CANONICAL:** `90`, `80`, `70`, `35`, `17`, `12`, `10`
   * *Formula:* $360 / 4 = 90 \implies$ `max-w-90` (never `max-w-[360px]`).

2. **Half-Step Multiples of 2px ($\text{px} \pmod 2 = 0$):**
   * Always write fractional scale numbers `N.5`.
   * **BANNED:** `[18px]`, `[14px]`, `[10px]`, `[6px]`, `[2px]`
   * **CANONICAL:** `4.5`, `3.5`, `2.5`, `1.5`, `0.5`
   * *Formula:* $18 / 4 = 4.5 \implies$ `size-4.5` (never `size-[18px]`).

3. **Only Use Arbitrary Brackets `[Npx]` if:**
   * Value is an odd pixel integer (e.g. `[3px]`, `[7px]`, `[13px]`) or non-quarter subpixel (`[12.5px]`).
   * For 1px, always use the dedicated keyword: `size-px`, `w-px`, `h-px`.

| Use Case | Banned Arbitrary Bracket | Canonical (v4) | Global Derivation |
| :--- | :--- | :--- | :--- |
| **Any width divisible by 4px** | `max-w-[360px]`, `w-[360px]` | `max-w-90`, `w-90` | $360 / 4 = 90$ |
| **Any width divisible by 4px** | `max-w-[320px]`, `w-[320px]` | `max-w-80`, `w-80` | $320 / 4 = 80$ |
| **Any height divisible by 4px** | `h-[140px]`, `max-h-[140px]` | `h-35`, `max-h-35` | $140 / 4 = 35$ |
| **Any dimension divisible by 2px** | `size-[18px]`, `w-[18px] h-[18px]` | `size-4.5` | $18 / 4 = 4.5$ |
| **Any dimension divisible by 2px** | `size-[14px]`, `w-[14px] h-[14px]` | `size-3.5` | $14 / 4 = 3.5$ |
| **Square Width + Height** | `w-5 h-5`, `w-12 h-12` | `size-5`, `size-12` | Unified dimension utility |
| **Full Square Size** | `w-full h-full` | `size-full` | Unified dimension utility |
| **Pixel Square Size (1px)** | `w-px h-px` | `size-px` | Unified dimension utility |
| **Dynamic Viewport Height** | `h-screen` *(mobile jumps)* | `h-dvh` *(dynamic)*, `h-svh`, `h-lvh` | Viewport with mobile toolbar resilience |
| **Dynamic Viewport Width** | `w-screen` | `w-dvw`, `w-svw`, `w-lvw` | Dynamic viewport widths |
| **Logical Sizing** | *(custom CSS)* | `inline-full`, `block-full` | Modern logical property sizing |

---

### Opacity & Color Slash Notation
Tailwind v4 supports bare percentage values without brackets for fine-grained opacities. Never use bracketed decimals like `/[0.02]` or legacy `*-opacity-*` helpers.

| Anti-pattern / Deprecated | Canonical (v4) | Notes / Meaning |
| :--- | :--- | :--- |
| `hover:bg-white/[0.02]` | `hover:bg-white/2` | Bare percentage: 2% opacity |
| `bg-white/[0.05]`, `bg-white/5` | `bg-white/5` | 5% opacity |
| `border-white/[0.08]` | `border-white/8` | 8% opacity |
| `bg-black/[0.15]` | `bg-black/15` | 15% opacity |
| `bg-white/[0.025]` | `bg-white/2.5` | 2.5% opacity (decimal percentage supported) |
| `bg-rose-500 bg-opacity-20` | `bg-rose-500/20` | Native slash notation |
| `text-slate-100 text-opacity-80` | `text-slate-100/80` | Native slash notation |
| `border-slate-800 border-opacity-50` | `border-slate-800/50` | Native slash notation |
| `ring-rose-500 ring-opacity-25` | `ring-rose-500/25` | Native slash notation |
| `placeholder-slate-400 placeholder-opacity-60` | `placeholder-slate-400/60` | Native slash notation |
| `divide-slate-700 divide-opacity-40` | `divide-slate-700/40` | Native slash notation |

---

### Important Modifier (!)
In Tailwind v4, the `!` modifier can be placed at the **end** of the utility name instead of the beginning. While both forms work in v4, placing `!` at the end matches CSS `!important` and improves readability across variant chains:

| Legacy / v3 Syntax | Canonical v4 Syntax | CSS Output |
| :--- | :--- | :--- |
| `!opacity-100` | `opacity-100!` | `opacity: 1 !important;` |
| `hover:!opacity-100` | `hover:opacity-100!` | `:hover { opacity: 1 !important; }` |
| `!hidden` | `hidden!` | `display: none !important;` |
| `!block` | `block!` | `display: block !important;` |
| `!bg-red-500` | `bg-red-500!` | `background-color: ... !important;` |
| `focus:!ring-2` | `focus:ring-2!` | `:focus { ... !important; }` |

---

### Text Wrapping & Word Breaking
Tailwind v4 cleanly separates `overflow-wrap` and `word-break`:

| Legacy / Ambiguous (v3) | Canonical (v4) | CSS Property |
| :--- | :--- | :--- |
| `break-words` | `wrap-break-word` | `overflow-wrap: break-word` |
| `break-words` *(anywhere)* | `wrap-anywhere` | `overflow-wrap: anywhere` |
| `break-all` | `break-all` | `word-break: break-all` |
| `overflow-ellipsis` | `text-ellipsis` | `text-overflow: ellipsis` |
| `overflow-clip` | `text-clip` | `text-overflow: clip` |

---

### Flexbox, Grid & Layout

| Legacy (v3) | Canonical (v4) | Notes |
| :--- | :--- | :--- |
| `flex-grow` | `grow` | `flex-grow: 1` |
| `flex-grow-0` | `grow-0` | `flex-grow: 0` |
| `flex-shrink` | `shrink` | `flex-shrink: 1` |
| `flex-shrink-0` | `shrink-0` | `flex-shrink: 0` |
| `decoration-slice` | `box-decoration-slice` | Full CSS property name |
| `decoration-clone` | `box-decoration-clone` | Full CSS property name |
| *(new)* | `grid-cols-subgrid`, `grid-rows-subgrid` | CSS Subgrid support |

---

### Outlines, Focus & Rings

| Legacy (v3) | Canonical (v4) | Notes |
| :--- | :--- | :--- |
| `outline-none` *(hiding focus)* | `outline-hidden` / `focus:outline-hidden` | Hides default browser focus outline (`outline: 2px solid transparent;`) |
| `outline-none` *(in v4)* | `outline-none` | Sets `outline-style: none` |
| *(new)* | `inset-ring`, `inset-ring-1` | Native inner border ring without clipping |
| *(new)* | `inset-shadow-xs`, `inset-shadow-sm` | Native inner shadows |

---

### Sizing Scale Shift (Shadows, Radii, Blurs)
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

### 3D Transforms (New in v4)
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
3. **Dynamic & Fractional Sizing:** Use continuous scale values like `max-w-90` (360px), `size-4.5` (18px), `size-3.5` (14px) instead of arbitrary brackets `max-w-[360px]` or `size-[18px]`.
4. **Percentage Opacities:** Use bare percentage slash notation like `hover:bg-white/2` or `bg-black/5` instead of bracketed decimals `hover:bg-white/[0.02]`.
5. **Word Wrapping:** `wrap-break-word` or `wrap-anywhere` used instead of `break-words`.
6. **Flexbox:** `grow` and `shrink-0` used instead of `flex-grow` / `flex-shrink-0`.
7. **Outlines:** `outline-hidden` / `focus:outline-hidden` used to suppress default outlines.
8. **Colors/Opacity:** Slash notation (`bg-rose-500/20`) used instead of separate opacity classes.
9. **Viewport Heights:** `h-dvh` preferred over `h-screen` for mobile resilience.
10. **Important Modifier:** Use trailing exclamation mark (`hover:opacity-100!`, `hidden!`) instead of legacy prefix syntax (`hover:!opacity-100`, `!hidden`).
