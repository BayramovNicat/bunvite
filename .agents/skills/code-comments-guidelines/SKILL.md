---
name: code-comments-guidelines
description: >-
  Strict standards and rules for code comments. Enforces clean, self-documenting code,
  bans decorative, redundant, or noisy comments, and defines exact criteria for when comments are permitted.
  Use when writing, refactoring, or reviewing code in any language across the project.
---

# Code Comments Guidelines & Noise Prevention

This skill defines strict rules regarding code comments. The overarching principle is: **Code should be self-documenting. Default to zero comments unless explicitly requested by the user or strictly justified by non-obvious rationale.**

---

## 1. The Comment Decision Matrix

Before writing any comment, apply this classification:

```
                  ┌────────────────────────────────────────┐
                  │ Is this comment explicitly requested?  │
                  └──────────────────┬─────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                   YES                                NO
                    │                                 │
         ┌─────────────────────┐       ┌───────────────────────────────┐
         │ Write concise,      │       │ Can better naming or cleaner  │
         │ targeted comment    │       │ code make this obvious?       │
         └─────────────────────┘       └──────────────┬────────────────┘
                                                      │
                                     ┌────────────────┴────────────────┐
                                    YES                                NO
                                     │                                 │
                         ┌───────────────────────┐         ┌───────────────────────┐
                         │ REFACTOR THE CODE.    │         │ Is it a non-obvious   │
                         │ DO NOT ADD A COMMENT. │         │ "Why" or bug bypass?  │
                         └───────────────────────┘         └───────────┬───────────┘
                                                                       │
                                                      ┌────────────────┴────────────────┐
                                                     YES                                NO
                                                      │                                 │
                                          ┌───────────────────────┐         ┌───────────────────────┐
                                          │ ALLOWED (Rare):       │         │ FORBIDDEN NOISE.      │
                                          │ Document the "Why"    │         │ DO NOT WRITE.         │
                                          └───────────────────────┘         └───────────────────────┘
```

---

## 2. 🚫 Forbidden Comments (Never Write)

The following comment types add visual noise, degrade readability, and become stale over time:

### 1. Paraphrasing / Restating the Obvious
Never restate in English what the code already says clearly:

```typescript
// ❌ FORBIDDEN:
const count = 0; // Initialize count to zero
inputEl.value = ""; // Clear input field
return todos.filter((t) => !t.completed); // Return active todos

// ✅ CLEAN:
const count = 0;
inputEl.value = "";
return todos.filter((t) => !t.completed);
```

### 2. Step-by-Step / Narrative Comments
Never narrate execution steps with numbered or sequential comments:

```typescript
// ❌ FORBIDDEN:
// 1. Get existing input value
const prev = input.value;
// 2. Re-create component
createApp(mountEl);
// 3. Restore previous value
input.value = prev;

// ✅ CLEAN:
const prev = input.value;
createApp(mountEl);
input.value = prev;
```

### 3. Section Banners & ASCII Dividers
Never divide files with visual banners, headers, or lines:

```typescript
// ❌ FORBIDDEN:
// ==========================================
// STORE & DISPATCH
// ==========================================
// ------------------------------------------
// Helper Functions
// ------------------------------------------

// ✅ CLEAN:
// Rely on logical module organization and spacing instead.
```

### 4. HTML & Template Labels
Never label obvious container tags or components:

```html
<!-- ❌ FORBIDDEN: -->
<!-- Main Todo Container -->
<div id="app"></div>
<!-- Live Reload Client -->
<script src="/vite.js"></script>

<!-- ✅ CLEAN: -->
<div id="app"></div>
<script src="/vite.js"></script>
```

### 5. Redundant JSDoc / Type Comments
Never write JSDoc tags that duplicate TypeScript types:

```typescript
// ❌ FORBIDDEN:
/**
 * Toggles a todo item
 * @param {AppState} state - The current app state
 * @param {string} id - The id of the todo
 * @returns {AppState} The new state
 */
export const toggleTodo = (state: AppState, id: string): AppState => ...

// ✅ CLEAN:
export const toggleTodo = (state: AppState, id: string): AppState => ...
```

### 6. Commented-Out / Dead Code
Never keep unused or superseded code in comments:

```typescript
// ❌ FORBIDDEN:
// const oldFilter = (t) => t.completed === false;
// function renderLegacy() { ... }

// ✅ CLEAN:
// Delete dead code completely. Git history preserves past versions.
```

---

## 3. ⚠️ Conditional Comments (Only When Asked)

Only write comments in these categories when the user explicitly requests them:

| Scenario | Example Prompt | Guideline |
| :--- | :--- | :--- |
| **Exploratory / Learning** | *"Explain how this works in comments"* | Add concise pedagogical explanations. |
| **Public API / SDK Docs** | *"Add JSDoc for exported functions"* | Document parameters and return types for external library consumers. |
| **Tutorial Code** | *"Create a beginner-friendly example"* | Add contextual comments explaining concepts. |

---

## 4. ✅ Permitted Comments (Rare & High-Value)

Comments are only acceptable when code alone cannot explain the context:

### 1. Documenting the "Why", Never the "What"
Explain non-obvious business rules, algorithmic math, or domain constraints:

```typescript
// ✅ PERMITTED:
// 40ms debounce matches the typical OS filesystem write buffer flush window
const DEBOUNCE_MS = 40;
```

### 2. Workarounds for External Bugs / Platform Quirks
Document strange workarounds with reference to the upstream bug or browser behavior:

```typescript
// ✅ PERMITTED:
// WebKit WebSockets require explicit data payload in Bun server.upgrade
server.upgrade(req, { data: undefined });
```

### 3. Critical Safety / Invariant Warnings
Highlight non-obvious traps that could cause silent failures or security issues:

```typescript
// ✅ PERMITTED:
// Must abort previous controller before mounting to prevent duplicate listener accumulation
controller.abort();
```

### 4. Language Injection & Tooling Directives
Tags recognized by editor language servers and formatters (such as `/*html*/`, `/*css*/`, `/*svg*/`) enable syntax highlighting, Emmet, and Prettier formatting inside template strings without any runtime performance cost. They are valid and encouraged:

```typescript
// ✅ PERMITTED (Tooling directive):
const template = /*html*/ `<div class="card"><h1>${title}</h1></div>`;
```

---

## 5. Review Checklist

When writing or reviewing any code:

1. [ ] **Zero Noise:** Are there any narrative (`// 1. ...`), paraphrasing, or section banner comments? If yes, **delete them**.
2. [ ] **Self-Documenting:** Can variable names, function names, or TypeScript types explain the code instead? If yes, **refactor and remove the comment**.
3. [ ] **Prompt Alignment:** Did the user ask for comments? If not, **do not add comments**.
4. [ ] **Justified Rationale:** If a comment remains, does it explain a non-obvious **Why** or platform workaround?
