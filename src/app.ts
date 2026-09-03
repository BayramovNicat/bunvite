type Priority = 'low' | 'medium' | 'high';
type ViewMode = 'inbox' | 'today' | 'calendar' | 'completed' | 'category';
type Filter = 'all' | 'active' | 'completed';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority?: Priority;
  dueDate?: string;
  category?: string;
}

interface AppState {
  todos: Todo[];
  filter: Filter;
  search: string;
  currentView: ViewMode;
  selectedCategory: string | null;
  selectedDate: string;
  calendarYear: number;
  calendarMonth: number;
  editingId: string | null;
  lastDeleted: { items: Todo[] } | null;
}

const STORAGE_KEY = 'bunvite_todos';
const CATEGORIES = ['General', 'Work', 'Personal'] as const;

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const loadSavedTodos = (): Todo[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string');
  } catch {
    return [];
  }
};

const saveTodos = (todos: Todo[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {}
};

declare global {
  interface Window {
    __hmr_state__?: AppState;
  }
}

const now = new Date();

const defaultState: AppState = {
  todos: loadSavedTodos(),
  filter: 'all',
  search: '',
  currentView: 'inbox',
  selectedCategory: null,
  selectedDate: getTodayStr(),
  calendarYear: now.getFullYear(),
  calendarMonth: now.getMonth(),
  editingId: null,
  lastDeleted: null,
};

var state: AppState = (window.__hmr_state__ ??= { ...defaultState });
Object.assign(state, defaultState, window.__hmr_state__);

const Check = /*svg*/ `<svg class="size-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const Close = /*svg*/ `<svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const Plus = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
const Pencil = /*svg*/ `<svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
const CheckCheck = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>`;
const Grip = /*svg*/ `<svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;
const InboxIcon = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`;
const SunIcon = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const CalendarIcon = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;
const CheckCircle = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;
const ChevronLeft = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;
const ChevronRight = /*svg*/ `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

let undoTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleUndoDismiss = () => {
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    state.lastDeleted = null;
    render();
  }, 4000);
};

const commitEdit = (id: string | null, newText: string) => {
  const trimmed = newText.trim();
  if (trimmed) {
    const item = state.todos.find((t) => t.id === id);
    if (item) item.text = trimmed;
  } else if (id) {
    state.todos = state.todos.filter((t) => t.id !== id);
  }
  state.editingId = null;
  saveTodos(state.todos);
  render();
};

const TodoEditRow = (t: Todo): string => /*html*/ `
  <li class="todo-item flex items-center gap-2 px-5 py-2.5 bg-zinc-800/50" data-id="${t.id}">
    <input type="text" data-edit-input="${t.id}" value="${escapeHtml(t.text)}" aria-label="Edit task description" class="flex-1 bg-zinc-800 border border-indigo-500/80 rounded-lg px-2.5 py-1 text-sm text-zinc-100 focus:outline-hidden" />
    <button type="button" data-action="save-edit" aria-label="Save edit" class="text-xs px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors cursor-pointer">Save</button>
    <button type="button" data-action="cancel-edit" aria-label="Cancel edit" class="text-xs px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">Cancel</button>
  </li>
`;

const TodoItem = (t: Todo, todayStr: string): string => {
  const priority = t.priority ?? 'low';
  const categoryBadge = t.category
    ? /*html*/ `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">${t.category}</span>`
    : '';

  const dateDisplay = t.dueDate
    ? /*html*/ `<span class="text-[11px] ${t.dueDate === todayStr ? 'text-indigo-400 font-medium' : 'text-zinc-400'}">${t.dueDate === todayStr ? 'Today' : t.dueDate}</span>`
    : '';

  const priorityBadgeStyle =
    priority === 'high'
      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
      : priority === 'medium'
        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800';

  const priorityLabel = priority === 'high' ? 'High' : priority === 'medium' ? 'Med' : 'Low';

  return /*html*/ `
    <li class="todo-item group list-none flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors cursor-grab active:cursor-grabbing border-y-2 border-transparent" data-id="${t.id}" draggable="true">
      <span class="drag-handle opacity-0 group-hover:opacity-40 hover:!opacity-100 text-zinc-400 shrink-0 select-none cursor-grab active:cursor-grabbing transition-opacity">${Grip}</span>
      <button type="button" data-action="toggle" aria-label="${t.completed ? 'Mark task as incomplete' : 'Mark task as complete'}" title="${t.completed ? 'Mark incomplete' : 'Mark complete'}" class="shrink-0 size-4.5 rounded-full border transition-all cursor-pointer flex items-center justify-center ${t.completed ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600 hover:border-zinc-400 bg-transparent'}">
        ${t.completed ? Check : ''}
      </button>
      <span class="todo-text flex-1 text-sm leading-relaxed select-none transition-colors cursor-pointer ${t.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}" data-action="toggle">${escapeHtml(t.text)}</span>
      <div class="flex items-center gap-1.5 shrink-0">
        ${categoryBadge}
        ${dateDisplay}
        <button type="button" data-action="priority" title="Priority: ${priority}" aria-label="Priority: ${priority}" class="text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors cursor-pointer ${priorityBadgeStyle}">
          ${priorityLabel}
        </button>
      </div>
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button type="button" data-action="edit" title="Edit task" aria-label="Edit task" class="size-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all cursor-pointer">${Pencil}</button>
        <button type="button" data-action="delete" title="Delete task" aria-label="Delete task" class="delete-btn size-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all cursor-pointer">${Close}</button>
      </div>
    </li>
  `;
};

const renderCalendar = (): string => {
  const cur = new Date();
  const year = state.calendarYear || cur.getFullYear();
  const month = state.calendarMonth ?? cur.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const today = getTodayStr();

  const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    cells.push({
      dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 1 : month + 2;
    const y = month === 11 ? year + 1 : year;
    cells.push({
      dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  return /*html*/ `
    <div class="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-3 select-none">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-zinc-200 tracking-tight">${MONTH_NAMES[month]} ${year}</span>
        <div class="flex items-center gap-1">
          <button type="button" data-action="prev-month" title="Previous month" aria-label="Previous month" class="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors cursor-pointer">${ChevronLeft}</button>
          <button type="button" data-action="cal-today" title="Go to today" aria-label="Go to today" class="px-2 py-0.5 rounded text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors cursor-pointer">Today</button>
          <button type="button" data-action="next-month" title="Next month" aria-label="Next month" class="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors cursor-pointer">${ChevronRight}</button>
        </div>
      </div>
      <div class="grid grid-cols-7 gap-0.5 text-center mb-1">
        ${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
          .map((d) => /*html*/ `<span class="text-[10px] font-medium text-zinc-400 py-1">${d}</span>`)
          .join('')}
      </div>
      <div class="grid grid-cols-7 gap-0.5">
        ${cells
          .map((c) => {
            const isSelected = c.dateStr === state.selectedDate;
            const isToday = c.dateStr === today;
            const dayTasks = state.todos.filter((t) => t.dueDate === c.dateStr);
            const hasActive = dayTasks.some((t) => !t.completed);

            const baseStyle = isSelected
              ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
              : isToday
                ? 'bg-zinc-800 text-indigo-400 font-semibold ring-1 ring-indigo-500/40'
                : c.isCurrentMonth
                  ? 'text-zinc-300 hover:bg-zinc-800/60'
                  : 'text-zinc-500 opacity-60 hover:bg-zinc-800/30';

            return /*html*/ `
            <button type="button" data-action="select-date" data-date="${c.dateStr}" aria-label="${c.dateStr}" class="relative h-8 rounded-lg flex flex-col items-center justify-center text-xs transition-colors cursor-pointer ${baseStyle}">
              <span>${c.dayNum}</span>
              ${
                dayTasks.length
                  ? /*html*/ `<span class="size-1 rounded-full absolute bottom-1 ${hasActive ? 'bg-indigo-400' : 'bg-zinc-600'}"></span>`
                  : ''
              }
            </button>
          `;
          })
          .join('')}
      </div>
    </div>
  `;
};

const renderSidebar = () => {
  const today = getTodayStr();
  const total = state.todos.length;
  const completedCount = state.todos.filter((t) => t.completed).length;
  const progressPercent = total ? Math.round((completedCount / total) * 100) : 0;
  const todayCount = state.todos.filter((t) => t.dueDate === today).length;

  const views: { id: ViewMode; label: string; icon: string; count?: number }[] = [
    { id: 'inbox', label: 'All Tasks', icon: InboxIcon, count: total },
    { id: 'today', label: 'Today', icon: SunIcon, count: todayCount },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'completed', label: 'Done', icon: CheckCircle, count: completedCount },
  ];

  return /*html*/ `
    <div class="space-y-6">
      <div class="space-y-1">
        <h2 class="text-xs font-semibold text-zinc-400 tracking-wider uppercase px-2 mb-2">Navigation</h2>
        ${views
          .map((v) => {
            const isActive = state.currentView === v.id;
            return /*html*/ `
            <button type="button" data-view="${v.id}" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isActive
                ? 'bg-indigo-500/15 text-indigo-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }">
              <div class="flex items-center gap-2">
                ${v.icon}
                <span>${v.label}</span>
              </div>
              ${v.count !== undefined ? /*html*/ `<span class="text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-800 text-zinc-400'}">${v.count}</span>` : ''}
            </button>
          `;
          })
          .join('')}
      </div>

      <div class="space-y-1">
        <div class="flex items-center justify-between px-2 mb-2">
          <h2 class="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Categories</h2>
          ${
            state.selectedCategory
              ? /*html*/ `<button type="button" data-action="clear-category" aria-label="Show all categories" class="text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer">All</button>`
              : ''
          }
        </div>
        ${CATEGORIES.map((cat) => {
          const isCatActive =
            state.currentView === 'category' && state.selectedCategory === cat;
          const catCount = state.todos.filter((t) => t.category === cat).length;
          const dotColor =
            cat === 'Work'
              ? 'bg-indigo-400'
              : cat === 'Personal'
                ? 'bg-emerald-400'
                : 'bg-purple-400';

          return /*html*/ `
            <button type="button" data-action="select-category" data-category="${cat}" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isCatActive
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }">
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full ${dotColor}"></span>
                <span>${cat}</span>
              </div>
              <span class="text-[11px] text-zinc-400">${catCount}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>

    <div class="pt-4 border-t border-zinc-800/60 space-y-2">
      <div class="flex items-center justify-between text-xs text-zinc-400">
        <span>Progress</span>
        <span class="font-medium text-zinc-300">${progressPercent}%</span>
      </div>
      <div class="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div class="bg-indigo-500 h-full transition-all duration-300 rounded-full" style="width: ${progressPercent}%"></div>
      </div>
      <p class="text-[11px] text-zinc-400 text-center">${completedCount} of ${total} tasks finished</p>
    </div>
  `;
};

const getVisibleTodos = (): Todo[] => {
  const query = state.search.toLowerCase().trim();
  const todayStr = getTodayStr();

  return state.todos.filter((t) => {
    if ((state.currentView === 'completed' || state.filter === 'completed') && !t.completed) return false;
    if (state.filter === 'active' && t.completed) return false;
    if (state.currentView === 'today' && t.dueDate !== todayStr) return false;
    if (state.currentView === 'calendar' && t.dueDate !== state.selectedDate) return false;
    if (state.currentView === 'category' && state.selectedCategory && t.category !== state.selectedCategory) return false;
    return !query || t.text.toLowerCase().includes(query);
  });
};

const renderBadgeContent = (): string =>
  state.todos.length
    ? /*html*/ `<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">${state.todos.length}</span>`
    : '';

const renderListContent = (): string => {
  const visible = getVisibleTodos();
  const todayStr = getTodayStr();

  const emptyMessage = state.search
    ? 'No matching tasks'
    : state.currentView === 'today'
      ? 'No tasks for today'
      : state.currentView === 'calendar'
        ? `No tasks for ${state.selectedDate}`
        : state.currentView === 'category'
          ? `No tasks in ${state.selectedCategory}`
          : state.filter === 'active'
            ? 'No active tasks'
            : state.filter === 'completed'
              ? 'No completed tasks'
              : 'No tasks here';

  return visible.length
    ? visible
        .map((t) => (state.editingId === t.id ? TodoEditRow(t) : TodoItem(t, todayStr)))
        .join('')
    : /*html*/ `<li class="list-none text-zinc-400 text-xs text-center py-8">${emptyMessage}</li>`;
};

const renderFooterContent = (): string => {
  const active = state.todos.filter((t) => !t.completed).length;

  return /*html*/ `
    <span class="text-xs text-zinc-400">${active} remaining</span>
    <div class="flex items-center gap-0.5">
      ${(['all', 'active', 'completed'] as const)
        .map(
          (f) => /*html*/ `
        <button type="button" data-filter="${f}" class="text-xs px-3 py-1 rounded-full transition-all cursor-pointer capitalize ${state.filter === f ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}">${f === 'completed' ? 'Done' : f}</button>
      `,
        )
        .join('')}
    </div>
    <button type="button" id="clear-btn" data-action="clear" aria-label="Clear completed tasks" class="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">Clear</button>
  `;
};

const renderToastContent = (): string =>
  state.lastDeleted
    ? /*html*/ `
      <div class="flex items-center gap-2.5 bg-zinc-800 border border-zinc-700/80 text-xs text-zinc-200 px-3.5 py-2 rounded-xl shadow-xl pointer-events-auto backdrop-blur-sm">
        <span>${state.lastDeleted.items.length === 1 ? 'Task deleted' : `${state.lastDeleted.items.length} tasks cleared`}</span>
        <button type="button" data-action="undo" class="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer">Undo</button>
      </div>
    `
    : '';

const root = document.querySelector('#app') as HTMLElement;

root.className = 'size-full relative flex overflow-hidden';
root.innerHTML = /*html*/ `
  <div class="size-full bg-zinc-900/90 flex flex-col md:flex-row overflow-hidden">
    <aside class="w-full md:w-64 shrink-0 bg-zinc-950/60 border-b md:border-b-0 md:border-r border-zinc-800/60 p-5 flex flex-col justify-between overflow-y-auto">${renderSidebar()}</aside>
    <main class="flex-1 flex flex-col justify-between overflow-hidden h-full">
      <div class="flex-1 overflow-y-auto flex flex-col">
        <header class="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div class="flex items-center gap-2">
            <h1 class="text-base font-semibold text-zinc-100 tracking-tight">Tasks</h1>
            <div class="badge-slot">${renderBadgeContent()}</div>
          </div>
          <div class="flex items-center gap-2">
            <input type="search" data-action="search" value="" placeholder="Search..." autocomplete="off" aria-label="Search tasks" class="w-28 focus:w-44 transition-all duration-150 bg-zinc-800/50 border border-zinc-700/40 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500/50" />
            <button type="button" data-action="toggle-all" title="Toggle all" aria-label="Toggle all tasks" class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer">${CheckCheck}</button>
          </div>
        </header>
        <div class="calendar-panel hidden px-6 pb-4 shrink-0"></div>
        <div class="px-6 pb-4 shrink-0">
          <form id="todo-form" class="space-y-2">
            <div class="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-all duration-150">
              <input id="todo-input" name="task" placeholder="Add a task... (/ to focus)" autocomplete="off" aria-label="Add a task" class="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 focus:outline-hidden" />
              <button type="submit" aria-label="Add task" title="Add task" class="text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer">${Plus}</button>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <input type="date" name="dueDate" value="${state.selectedDate}" aria-label="Due date" title="Due date" class="bg-zinc-800/40 border border-zinc-700/40 rounded-lg px-2 py-1 text-zinc-300 focus:outline-hidden focus:border-indigo-500/50 text-xs" />
              <select name="category" aria-label="Task category" title="Task category" class="bg-zinc-800/40 border border-zinc-700/40 rounded-lg px-2 py-1 text-zinc-300 focus:outline-hidden focus:border-indigo-500/50 text-xs cursor-pointer">
                ${CATEGORIES.map((c) => /*html*/ `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
          </form>
        </div>
        <div class="flex-1 overflow-y-auto px-6">
          <ul class="divide-y divide-zinc-800/60 border-t border-zinc-800/60 list-none p-0 m-0">${renderListContent()}</ul>
        </div>
      </div>
      <footer class="flex items-center justify-between px-6 py-3.5 border-t border-zinc-800/60 shrink-0 bg-zinc-950/20">${renderFooterContent()}</footer>
    </main>
  </div>
  <div class="toast-slot fixed bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">${renderToastContent()}</div>
`;

let sidebarEl: HTMLElement | null = null;
let badgeSlotEl: HTMLElement | null = null;
let calendarPanelEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let footerEl: HTMLElement | null = null;
let toastSlotEl: HTMLElement | null = null;

const form = root.querySelector('#todo-form') as HTMLFormElement;
const searchInput = root.querySelector('input[data-action="search"]') as HTMLInputElement;

const syncDueDateInput = (date: string): void => {
  const dateInput = form.elements.namedItem('dueDate') as HTMLInputElement | null;
  if (dateInput) dateInput.value = date;
};

const render = () => {
  sidebarEl ??= root.querySelector('aside');
  badgeSlotEl ??= root.querySelector('.badge-slot');
  calendarPanelEl ??= root.querySelector('.calendar-panel');
  listEl ??= root.querySelector('ul');
  footerEl ??= root.querySelector('footer');
  toastSlotEl ??= root.querySelector('.toast-slot');

  if (sidebarEl) sidebarEl.innerHTML = renderSidebar();

  if (state.currentView === 'calendar') {
    calendarPanelEl?.classList.remove('hidden');
    if (calendarPanelEl) calendarPanelEl.innerHTML = renderCalendar();
  } else {
    calendarPanelEl?.classList.add('hidden');
  }

  if (badgeSlotEl) badgeSlotEl.innerHTML = renderBadgeContent();
  if (listEl) listEl.innerHTML = renderListContent();
  if (footerEl) footerEl.innerHTML = renderFooterContent();
  if (toastSlotEl) toastSlotEl.innerHTML = renderToastContent();

  if (state.editingId) {
    const editInput = root.querySelector<HTMLInputElement>(`input[data-edit-input="${state.editingId}"]`);
    if (editInput) {
      editInput.focus();
      editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    }
  }
};

form.onsubmit = (e) => {
  e.preventDefault();
  const text = (form.elements.namedItem('task') as HTMLInputElement).value.trim();
  if (!text) return;

  const dueDate = (form.elements.namedItem('dueDate') as HTMLInputElement)?.value || state.selectedDate;
  const category = (form.elements.namedItem('category') as HTMLSelectElement)?.value || 'General';

  state.todos.push({
    id: crypto.randomUUID(),
    text,
    completed: false,
    priority: 'low',
    dueDate,
    category,
  });

  saveTodos(state.todos);
  form.reset();
  syncDueDateInput(state.selectedDate);
  render();
};

searchInput.oninput = () => {
  state.search = searchInput.value;
  render();
};

root.onclick = (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-filter], [data-view]');
  if (!el) return;

  const { action, filter, view, category, date } = el.dataset;
  const id = el.closest<HTMLElement>('[data-id]')?.dataset.id;
  const item = state.todos.find((t) => t.id === id);

  if (view) {
    state.currentView = view as ViewMode;
    if (view === 'completed') state.filter = 'completed';
    else if (state.filter === 'completed') state.filter = 'all';
  } else if (action === 'select-category' && category) {
    state.currentView = 'category';
    state.selectedCategory = category;
  } else if (action === 'clear-category') {
    state.selectedCategory = null;
    state.currentView = 'inbox';
  } else if (action === 'select-date' && date) {
    state.selectedDate = date;
    syncDueDateInput(date);
  } else if (action === 'prev-month') {
    if (--state.calendarMonth < 0) {
      state.calendarMonth = 11;
      state.calendarYear--;
    }
  } else if (action === 'next-month') {
    if (++state.calendarMonth > 11) {
      state.calendarMonth = 0;
      state.calendarYear++;
    }
  } else if (action === 'cal-today') {
    const now = new Date();
    state.calendarYear = now.getFullYear();
    state.calendarMonth = now.getMonth();
    state.selectedDate = getTodayStr();
    syncDueDateInput(state.selectedDate);
  } else if (filter) {
    state.filter = filter as Filter;
  } else if (action === 'clear') {
    const completed = state.todos.filter((t) => t.completed);
    if (completed.length) {
      state.lastDeleted = { items: completed };
      state.todos = state.todos.filter((t) => !t.completed);
      scheduleUndoDismiss();
    }
  } else if (action === 'toggle' && item) {
    item.completed = !item.completed;
  } else if (action === 'toggle-all') {
    const hasActive = state.todos.some((t) => !t.completed);
    for (const t of state.todos) t.completed = hasActive;
  } else if (action === 'delete' && id) {
    const idx = state.todos.findIndex((t) => t.id === id);
    if (idx !== -1) {
      state.lastDeleted = { items: [state.todos[idx]] };
      state.todos.splice(idx, 1);
      scheduleUndoDismiss();
    }
  } else if (action === 'edit' && id) {
    state.editingId = id;
  } else if (action === 'save-edit' && id) {
    const editInput = root.querySelector<HTMLInputElement>(`input[data-edit-input="${id}"]`);
    if (editInput) commitEdit(id, editInput.value);
    return;
  } else if (action === 'cancel-edit') {
    state.editingId = null;
  } else if (action === 'priority' && item) {
    const cycle: Record<Priority, Priority> = { low: 'medium', medium: 'high', high: 'low' };
    item.priority = cycle[item.priority ?? 'low'];
  } else if (action === 'undo' && state.lastDeleted) {
    state.todos.push(...state.lastDeleted.items);
    state.lastDeleted = null;
    if (undoTimer) clearTimeout(undoTimer);
  } else {
    return;
  }

  saveTodos(state.todos);
  render();
};

root.onkeydown = (e) => {
  const target = e.target as HTMLElement;
  if (target.hasAttribute('data-edit-input')) {
    const id = target.getAttribute('data-edit-input');
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(id, (target as HTMLInputElement).value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      state.editingId = null;
      render();
    }
  } else if (e.key === '/' && target.tagName !== 'INPUT' && target.tagName !== 'SELECT') {
    e.preventDefault();
    (form.elements.namedItem('task') as HTMLInputElement).focus();
  }
};

let draggedId: string | null = null;
let dropTargetId: string | null = null;
let dropBelow = false;

const clearDropIndicators = (): void => {
  for (const el of root.querySelectorAll<HTMLElement>('.todo-item')) {
    el.classList.remove(
      'border-t-indigo-500',
      'border-b-indigo-500',
      'opacity-40',
      'bg-zinc-800/40',
    );
  }
};

setTimeout(() => {
  root.ondragstart = (e) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('input, button:not(.drag-handle), select') &&
      !target.closest('.drag-handle')
    ) {
      e.preventDefault();
      return;
    }

    const li = target.closest<HTMLElement>('li[data-id]');
    if (!li || state.editingId === li.dataset.id) {
      e.preventDefault();
      return;
    }

    draggedId = li.dataset.id ?? null;
    dropTargetId = null;
    dropBelow = false;

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId ?? '');
    }

    setTimeout(() => {
      li.classList.add('opacity-40', 'bg-zinc-800/40');
    }, 0);
  };

  root.ondragover = (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    const targetLi = (e.target as HTMLElement).closest<HTMLElement>('li[data-id]');
    if (!targetLi || !draggedId || targetLi.dataset.id === draggedId) {
      for (const el of root.querySelectorAll<HTMLElement>('.todo-item')) {
        el.classList.remove('border-t-indigo-500', 'border-b-indigo-500');
      }
      dropTargetId = null;
      return;
    }

    const rect = targetLi.getBoundingClientRect();
    const isBelow = e.clientY > rect.top + rect.height / 2;
    const targetId = targetLi.dataset.id ?? null;

    if (dropTargetId !== targetId || dropBelow !== isBelow) {
      for (const el of root.querySelectorAll<HTMLElement>('.todo-item')) {
        el.classList.remove('border-t-indigo-500', 'border-b-indigo-500');
      }
      dropTargetId = targetId;
      dropBelow = isBelow;

      if (isBelow) {
        targetLi.classList.add('border-b-indigo-500');
      } else {
        targetLi.classList.add('border-t-indigo-500');
      }
    }
  };

  root.ondragleave = (e) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !root.contains(related)) {
      clearDropIndicators();
      dropTargetId = null;
    }
  };

  root.ondragend = () => {
    clearDropIndicators();
    draggedId = null;
    dropTargetId = null;
  };

  root.ondrop = (e) => {
    e.preventDefault();
    const targetLi = (e.target as HTMLElement).closest<HTMLElement>('li[data-id]');
    if (!targetLi || !draggedId) {
      clearDropIndicators();
      return;
    }

    const targetId = targetLi.dataset.id;
    if (!targetId || targetId === draggedId) {
      clearDropIndicators();
      return;
    }

    const fromIndex = state.todos.findIndex((t) => t.id === draggedId);
    const toIndex = state.todos.findIndex((t) => t.id === targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const rect = targetLi.getBoundingClientRect();
      const isBelow = e.clientY > rect.top + rect.height / 2;

      const [moved] = state.todos.splice(fromIndex, 1);
      let insertIndex = state.todos.findIndex((t) => t.id === targetId);
      if (isBelow) insertIndex++;

      state.todos.splice(insertIndex, 0, moved);
      saveTodos(state.todos);
    }

    clearDropIndicators();
    draggedId = null;
    dropTargetId = null;
    render();
  };

  root.ondblclick = (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.todo-text');
    if (!el) return;
    const id = el.closest<HTMLElement>('[data-id]')?.dataset.id;
    if (!id) return;
    state.editingId = id;
    render();
  };

  window.onstorage = (e) => {
    if (e.key === STORAGE_KEY) {
      state.todos = loadSavedTodos();
      render();
    }
  };
}, 0);
