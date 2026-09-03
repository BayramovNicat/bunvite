export type Filter = 'all' | 'active' | 'completed';
export type Priority = 'low' | 'medium' | 'high';
export type ViewMode = 'inbox' | 'today' | 'calendar' | 'completed' | 'category';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority?: Priority;
  dueDate?: string;
  category?: string;
}

export interface AppState {
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

const root = document.querySelector('#app') as HTMLElement;

root.className = 'size-full relative flex overflow-hidden';
root.innerHTML = /*html*/ `
  <div class="size-full bg-zinc-900/90 flex flex-col md:flex-row overflow-hidden">
    <aside class="w-full md:w-64 shrink-0 bg-zinc-950/60 border-b md:border-b-0 md:border-r border-zinc-800/60 p-5 flex flex-col justify-between overflow-y-auto"></aside>
    <main class="flex-1 flex flex-col justify-between overflow-hidden h-full">
      <div class="flex-1 overflow-y-auto flex flex-col">
        <header class="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div class="flex items-center gap-2">
            <h1 class="text-base font-semibold text-zinc-100 tracking-tight">Tasks</h1>
            <div class="badge-slot"></div>
          </div>
          <div class="flex items-center gap-2">
            <input type="search" data-action="search" value="" placeholder="Search..." autocomplete="off" class="w-28 focus:w-44 transition-all duration-150 bg-zinc-800/50 border border-zinc-700/40 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500/50" />
            <button type="button" data-action="toggle-all" title="Toggle all" class="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors cursor-pointer">${CheckCheck}</button>
          </div>
        </header>
        <div class="calendar-panel hidden px-6 pb-4 shrink-0"></div>
        <div class="px-6 pb-4 shrink-0">
          <form id="todo-form" class="space-y-2">
            <div class="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-all duration-150">
              <input id="todo-input" name="task" placeholder="Add a task... (/ to focus)" autocomplete="off" class="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 focus:outline-hidden" />
              <button type="submit" class="text-zinc-500 hover:text-indigo-400 transition-colors cursor-pointer">${Plus}</button>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <input type="date" name="dueDate" value="${state.selectedDate}" class="bg-zinc-800/40 border border-zinc-700/40 rounded-lg px-2 py-1 text-zinc-300 focus:outline-hidden focus:border-indigo-500/50 text-xs" />
              <select name="category" class="bg-zinc-800/40 border border-zinc-700/40 rounded-lg px-2 py-1 text-zinc-300 focus:outline-hidden focus:border-indigo-500/50 text-xs cursor-pointer">
                ${CATEGORIES.map((c) => /*html*/ `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
          </form>
        </div>
        <div class="flex-1 overflow-y-auto px-6">
          <ul class="divide-y divide-zinc-800/60 border-t border-zinc-800/60 list-none p-0 m-0"></ul>
        </div>
      </div>
      <footer class="flex items-center justify-between px-6 py-3.5 border-t border-zinc-800/60 shrink-0 bg-zinc-950/20"></footer>
    </main>
  </div>
  <div class="toast-slot fixed bottom-5 left-1/2 -translate-x-1/2 pointer-events-none"></div>
`;

const sidebar = root.querySelector('aside') as HTMLElement;
const badgeSlot = root.querySelector('.badge-slot') as HTMLElement;
const calendarPanel = root.querySelector('.calendar-panel') as HTMLElement;
const list = root.querySelector('ul') as HTMLElement;
const footer = root.querySelector('footer') as HTMLElement;
const form = root.querySelector('#todo-form') as HTMLFormElement;
const toastSlot = root.querySelector('.toast-slot') as HTMLElement;
const searchInput = root.querySelector('input[data-action="search"]') as HTMLInputElement;

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

const syncDueDateInput = (date: string): void => {
  const dateInput = form.elements.namedItem('dueDate') as HTMLInputElement | null;
  if (dateInput) dateInput.value = date;
};

const TodoEditRow = (t: Todo): string => /*html*/ `
  <li class="todo-item flex items-center gap-2 px-5 py-2.5 bg-zinc-800/50" data-id="${t.id}">
    <input type="text" data-edit-input="${t.id}" value="${escapeHtml(t.text)}" class="flex-1 bg-zinc-800 border border-indigo-500/80 rounded-lg px-2.5 py-1 text-sm text-zinc-100 focus:outline-hidden" />
    <button type="button" data-action="save-edit" class="text-xs px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors cursor-pointer">Save</button>
    <button type="button" data-action="cancel-edit" class="text-xs px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">Cancel</button>
  </li>
`;

const TodoItem = (t: Todo, todayStr: string): string => {
  const priority = t.priority ?? 'low';
  const categoryBadge = t.category
    ? /*html*/ `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">${t.category}</span>`
    : '';

  const dateDisplay = t.dueDate
    ? /*html*/ `<span class="text-[11px] ${t.dueDate === todayStr ? 'text-indigo-400 font-medium' : 'text-zinc-500'}">${t.dueDate === todayStr ? 'Today' : t.dueDate}</span>`
    : '';

  const priorityBadgeStyle =
    priority === 'high'
      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
      : priority === 'medium'
        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800';

  const priorityLabel = priority === 'high' ? 'High' : priority === 'medium' ? 'Med' : 'Low';

  return /*html*/ `
    <li class="todo-item group list-none flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors cursor-grab active:cursor-grabbing border-y-2 border-transparent" data-id="${t.id}" draggable="true">
      <span class="drag-handle opacity-0 group-hover:opacity-40 hover:!opacity-100 text-zinc-500 shrink-0 select-none cursor-grab active:cursor-grabbing transition-opacity">${Grip}</span>
      <button type="button" data-action="toggle" class="shrink-0 size-4.5 rounded-full border transition-all cursor-pointer flex items-center justify-center ${t.completed ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600 hover:border-zinc-400 bg-transparent'}">
        ${t.completed ? Check : ''}
      </button>
      <span class="todo-text flex-1 text-sm leading-relaxed select-none transition-colors cursor-pointer ${t.completed ? 'line-through text-zinc-600' : 'text-zinc-200'}" data-action="toggle">${escapeHtml(t.text)}</span>
      <div class="flex items-center gap-1.5 shrink-0">
        ${categoryBadge}
        ${dateDisplay}
        <button type="button" data-action="priority" title="Priority: ${priority}" class="text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors cursor-pointer ${priorityBadgeStyle}">
          ${priorityLabel}
        </button>
      </div>
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button type="button" data-action="edit" title="Edit task" class="size-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all cursor-pointer">${Pencil}</button>
        <button type="button" data-action="delete" title="Delete task" class="delete-btn size-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all cursor-pointer">${Close}</button>
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
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    cells.push({
      dateStr: `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      dayNum: i,
      isCurrentMonth: true,
    });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      cells.push({
        dateStr: `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        dayNum: i,
        isCurrentMonth: false,
      });
    }
  }

  return /*html*/ `
    <div class="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-3.5 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">
          <button type="button" data-action="prev-month" class="size-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer">${ChevronLeft}</button>
          <span class="text-sm font-semibold text-zinc-200 tracking-tight">${MONTH_NAMES[month]} ${year}</span>
          <button type="button" data-action="next-month" class="size-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer">${ChevronRight}</button>
        </div>
        <button type="button" data-action="cal-today" class="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">Today</button>
      </div>
      <div class="grid grid-cols-7 text-center text-[11px] font-medium text-zinc-500">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>
      <div class="grid grid-cols-7 gap-1">
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
                  : 'text-zinc-600 opacity-40 hover:bg-zinc-800/30';

            return /*html*/ `
            <button type="button" data-action="select-date" data-date="${c.dateStr}" class="relative h-8 rounded-lg flex flex-col items-center justify-center text-xs transition-colors cursor-pointer ${baseStyle}">
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
        <h2 class="text-xs font-semibold text-zinc-500 tracking-wider uppercase px-2 mb-2">Navigation</h2>
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
              ${v.count !== undefined ? /*html*/ `<span class="text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-800 text-zinc-500'}">${v.count}</span>` : ''}
            </button>
          `;
          })
          .join('')}
      </div>

      <div class="space-y-1">
        <div class="flex items-center justify-between px-2 mb-2">
          <h2 class="text-xs font-semibold text-zinc-500 tracking-wider uppercase">Categories</h2>
          ${
            state.selectedCategory
              ? /*html*/ `<button type="button" data-action="clear-category" class="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer">All</button>`
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
              <span class="text-[11px] text-zinc-600">${catCount}</span>
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
      <p class="text-[11px] text-zinc-600 text-center">${completedCount} of ${total} tasks finished</p>
    </div>
  `;
};

const render = () => {
  sidebar.innerHTML = renderSidebar();

  if (state.currentView === 'calendar') {
    calendarPanel.classList.remove('hidden');
    calendarPanel.innerHTML = renderCalendar();
  } else {
    calendarPanel.classList.add('hidden');
  }

  const query = state.search.toLowerCase().trim();
  const todayStr = getTodayStr();

  const visible = state.todos.filter((t) => {
    if ((state.currentView === 'completed' || state.filter === 'completed') && !t.completed) return false;
    if (state.filter === 'active' && t.completed) return false;
    if (state.currentView === 'today' && t.dueDate !== todayStr) return false;
    if (state.currentView === 'calendar' && t.dueDate !== state.selectedDate) return false;
    if (state.currentView === 'category' && state.selectedCategory && t.category !== state.selectedCategory) return false;
    return !query || t.text.toLowerCase().includes(query);
  });

  const active = state.todos.filter((t) => !t.completed).length;

  badgeSlot.innerHTML = state.todos.length
    ? /*html*/ `<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">${state.todos.length}</span>`
    : '';

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

  list.innerHTML = visible.length
    ? visible
        .map((t) => (state.editingId === t.id ? TodoEditRow(t) : TodoItem(t, todayStr)))
        .join('')
    : /*html*/ `<p class="text-zinc-600 text-xs text-center py-8">${emptyMessage}</p>`;

  footer.innerHTML = /*html*/ `
    <span class="text-xs text-zinc-600">${active} remaining</span>
    <div class="flex items-center gap-0.5">
      ${(['all', 'active', 'completed'] as const)
        .map(
          (f) => /*html*/ `
        <button type="button" data-filter="${f}" class="text-xs px-3 py-1 rounded-full transition-all cursor-pointer capitalize ${state.filter === f ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-zinc-500 hover:text-zinc-300'}">${f === 'completed' ? 'Done' : f}</button>
      `,
        )
        .join('')}
    </div>
    <button type="button" id="clear-btn" data-action="clear" class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer">Clear</button>
  `;

  toastSlot.innerHTML = state.lastDeleted
    ? /*html*/ `
      <div class="flex items-center gap-2.5 bg-zinc-800 border border-zinc-700/80 text-xs text-zinc-200 px-3.5 py-2 rounded-xl shadow-xl pointer-events-auto backdrop-blur-sm">
        <span>${state.lastDeleted.items.length === 1 ? 'Task deleted' : `${state.lastDeleted.items.length} tasks cleared`}</span>
        <button type="button" data-action="undo" class="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer">Undo</button>
      </div>
    `
    : '';

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

render();
