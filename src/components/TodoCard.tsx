/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h } from '../jsx';

export interface TodoCardProps {
  title: string;
  count: number;
  onAdd?: (text: string) => void;
}

export function TodoCard({ title, count, onAdd }: TodoCardProps): HTMLElement {
  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('task') as HTMLInputElement;
    const text = input?.value.trim();
    if (text) {
      onAdd?.(text);
      form.reset();
    }
  };

  return (
    <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">{title}</h1>
          <span className="badge text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
            {count}
          </span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-colors">
          <input
            name="task"
            placeholder="Add a new task via TSX..."
            autoComplete="off"
            aria-label="Add a task"
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 focus:outline-hidden"
          />
          <button
            type="submit"
            aria-label="Add task"
            className="text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <svg
              className="size-4 pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  ) as HTMLElement;
}
