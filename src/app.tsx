const root = document.querySelector('#app') as HTMLElement;
const state = { count: 0 };

const render = () => {
  root.replaceChildren(
    <main class="size-full flex flex-col items-center justify-center p-6 font-sans">
      <div class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          ⚡ Bun + Tailwind v4 + TSX
        </div>

        <h1 class="text-3xl font-bold tracking-tight text-zinc-100">BunVite</h1>
        <p class="text-sm text-zinc-400">Blazing-fast zero-dependency Vite alternative.</p>

        <div class="p-6 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl flex flex-col items-center gap-3">
          <span class="text-xs text-zinc-500 uppercase tracking-widest font-mono">Counter</span>
          <span id="counter" class="text-5xl font-mono font-extrabold text-indigo-400">{state.count}</span>
          <button
            id="increment-btn"
            type="button"
            class="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-medium rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
            onClick={() => {
              state.count++;
              render();
            }}
          >
            Increment Count
          </button>
        </div>

        <p class="text-xs text-zinc-500 font-mono">
          Edit <code class="text-zinc-300">src/app.tsx</code> to test instant HMR
        </p>
      </div>
    </main>,
  );
};

render();
