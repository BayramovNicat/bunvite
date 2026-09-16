import {
  buildProduction,
  type BuildProductionResult,
  type BuildStageTimings,
  CONFIG,
} from './vite';

export interface BenchmarkStats {
  samples: number[];
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  p95: number;
}

export interface StageStat {
  name: string;
  mean: number;
  percentage: number;
}

export interface ArtifactStat {
  path: string;
  size: number;
  gzip: number;
  ratio: number;
}

export interface BenchmarkResult {
  timestamp: string;
  config: {
    runs: number;
    warmup: number;
    includeCli: boolean;
  };
  inProcess: {
    warmup: number[];
    stats: BenchmarkStats;
    stages: Record<keyof BuildStageTimings, StageStat>;
  };
  cli?: {
    stats: BenchmarkStats;
  };
  artifacts: ArtifactStat[];
  totals: {
    size: number;
    gzip: number;
    ratio: number;
  };
}

export interface BenchmarkOptions {
  runs?: number;
  warmup?: number;
  includeCli?: boolean;
  silent?: boolean;
}

const STAGE_LABELS: Record<keyof BuildStageTimings, string> = {
  setup: 'Setup & Public Assets',
  js: 'JS Bundle (Bun.build)',
  css: 'CSS Compile (Tailwind)',
  html: 'HTML & Preload Wiring',
  summary: 'Output Stats & Gzip',
};

export function calculateStats(samples: number[]): BenchmarkStats {
  if (samples.length === 0) {
    return { samples: [], min: 0, max: 0, mean: 0, median: 0, stdDev: 0, p95: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  const p95Index = Math.min(Math.ceil(sorted.length * 0.95) - 1, sorted.length - 1);
  const p95 = sorted[p95Index];

  return { samples, min, max, mean, median, stdDev, p95 };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} kB`;
}

export function formatMs(ms: number): string {
  return `${ms.toFixed(1)} ms`;
}

export async function runCliBuild(): Promise<number> {
  const start = performance.now();
  const proc = Bun.spawn(['bun', 'run', 'vite.ts', 'build'], {
    cwd: CONFIG.root,
    stdout: 'ignore',
    stderr: 'ignore',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`CLI build failed with exit code ${exitCode}`);
  }
  return performance.now() - start;
}

export async function runBenchmark(options: BenchmarkOptions = {}): Promise<BenchmarkResult> {
  const runs = Math.max(1, options.runs ?? 5);
  const warmup = Math.max(0, options.warmup ?? 1);
  const includeCli = options.includeCli ?? false;
  const silent = options.silent ?? false;

  const log = silent ? () => {} : console.log;

  log('\n⚡ BunVite Build Benchmark');
  log(`   Measured Runs: ${runs} │ Warmup Runs: ${warmup}\n`);

  const warmupTimes: number[] = [];
  for (let i = 0; i < warmup; i++) {
    log(`[warmup ${i + 1}/${warmup}] Warming up caches...`);
    const res = await buildProduction({ silent: true });
    warmupTimes.push(res.elapsed);
  }

  const inProcessTimes: number[] = [];
  const stageSums: Record<keyof BuildStageTimings, number> = {
    setup: 0,
    js: 0,
    css: 0,
    html: 0,
    summary: 0,
  };

  let lastResult: BuildProductionResult | null = null;

  for (let i = 0; i < runs; i++) {
    const res = await buildProduction({ silent: true });
    lastResult = res;
    inProcessTimes.push(res.elapsed);

    for (const key of Object.keys(stageSums) as Array<keyof BuildStageTimings>) {
      stageSums[key] += res.stages[key];
    }

    log(`[run ${i + 1}/${runs}] In-process build: ${formatMs(res.elapsed)}`);
  }

  const inProcessStats = calculateStats(inProcessTimes);

  const stageEntries = Object.entries(stageSums) as Array<[keyof BuildStageTimings, number]>;
  const stagesRecord = {} as Record<keyof BuildStageTimings, StageStat>;

  for (const [key, totalDuration] of stageEntries) {
    const stageMean = totalDuration / runs;
    const percentage = inProcessStats.mean > 0 ? (stageMean / inProcessStats.mean) * 100 : 0;
    stagesRecord[key] = {
      name: STAGE_LABELS[key],
      mean: stageMean,
      percentage,
    };
  }

  let cliStats: BenchmarkStats | undefined;
  if (includeCli) {
    log('\n🚀 Spawning CLI build subprocesses...');
    if (warmup > 0) {
      await runCliBuild();
    }
    const cliTimes: number[] = [];
    for (let i = 0; i < runs; i++) {
      const cliDuration = await runCliBuild();
      cliTimes.push(cliDuration);
      log(`[cli ${i + 1}/${runs}] CLI process build: ${formatMs(cliDuration)}`);
    }
    cliStats = calculateStats(cliTimes);
  }

  const rawArtifacts = lastResult?.summary ?? [];
  let totalRawSize = 0;
  let totalGzipSize = 0;

  const artifacts: ArtifactStat[] = rawArtifacts.map((item) => {
    totalRawSize += item.size;
    totalGzipSize += item.gzip;
    const ratio = item.size > 0 ? ((item.size - item.gzip) / item.size) * 100 : 0;
    return {
      path: item.path,
      size: item.size,
      gzip: item.gzip,
      ratio,
    };
  });

  const totalRatio =
    totalRawSize > 0 ? ((totalRawSize - totalGzipSize) / totalRawSize) * 100 : 0;

  return {
    timestamp: new Date().toISOString(),
    config: { runs, warmup, includeCli },
    inProcess: {
      warmup: warmupTimes,
      stats: inProcessStats,
      stages: stagesRecord,
    },
    cli: cliStats ? { stats: cliStats } : undefined,
    artifacts,
    totals: {
      size: totalRawSize,
      gzip: totalGzipSize,
      ratio: totalRatio,
    },
  };
}

export function printBenchmarkReport(result: BenchmarkResult): void {
  const { inProcess, cli, artifacts, totals } = result;
  const { stats } = inProcess;

  console.log(`\n📊 In-Process Build Performance (${stats.samples.length} runs)`);
  console.log(`   Mean:       ${formatMs(stats.mean).padStart(9)} (±${formatMs(stats.stdDev)})`);
  console.log(`   Median:     ${formatMs(stats.median).padStart(9)}`);
  console.log(`   Min:        ${formatMs(stats.min).padStart(9)}`);
  console.log(`   Max:        ${formatMs(stats.max).padStart(9)}`);
  console.log(`   P95:        ${formatMs(stats.p95).padStart(9)}`);
  if (inProcess.warmup.length > 0) {
    const avgWarmup =
      inProcess.warmup.reduce((a, b) => a + b, 0) / inProcess.warmup.length;
    console.log(`   Warmup:     ${formatMs(avgWarmup).padStart(9)}`);
  }

  console.log('\n⏱️  Phase Breakdown (Average Duration)');
  const sortedStages = Object.values(inProcess.stages).sort((a, b) => b.mean - a.mean);
  for (const stage of sortedStages) {
    const namePadded = stage.name.padEnd(26);
    const msPadded = formatMs(stage.mean).padStart(9);
    const pctPadded = `${stage.percentage.toFixed(1)}%`.padStart(6);
    console.log(`   ${namePadded} ${msPadded}  (${pctPadded})`);
  }

  if (cli) {
    const cliMean = cli.stats.mean;
    const overhead = Math.max(0, cliMean - stats.mean);
    console.log(`\n🚀 CLI Subprocess Execution (${cli.stats.samples.length} runs)`);
    console.log(`   Mean:       ${formatMs(cliMean).padStart(9)} (±${formatMs(cli.stats.stdDev)})`);
    console.log(`   Median:     ${formatMs(cli.stats.median).padStart(9)}`);
    console.log(`   Min:        ${formatMs(cli.stats.min).padStart(9)}`);
    console.log(`   Max:        ${formatMs(cli.stats.max).padStart(9)}`);
    console.log(`   Overhead:   ${formatMs(overhead).padStart(9)} (process startup & spawn)`);
  }

  console.log('\n📦 Output Bundle Artifacts');
  console.log(
    `   ${'Asset'.padEnd(32)} ${'Size'.padStart(10)} ${'Gzip'.padStart(10)} ${'Saved'.padStart(8)}`,
  );
  console.log(`   ${'─'.repeat(32)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(8)}`);

  for (const item of artifacts) {
    const p = item.path.length > 32 ? `...${item.path.slice(-29)}` : item.path;
    const pPadded = p.padEnd(32);
    const sizePadded = formatBytes(item.size).padStart(10);
    const gzipPadded = formatBytes(item.gzip).padStart(10);
    const ratioPadded = `${item.ratio.toFixed(1)}%`.padStart(8);
    console.log(`   ${pPadded} ${sizePadded} ${gzipPadded} ${ratioPadded}`);
  }

  console.log(`   ${'─'.repeat(32)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(8)}`);
  const totalPadded = 'Total'.padEnd(32);
  const totalSizePadded = formatBytes(totals.size).padStart(10);
  const totalGzipPadded = formatBytes(totals.gzip).padStart(10);
  const totalRatioPadded = `${totals.ratio.toFixed(1)}%`.padStart(8);
  console.log(
    `   ${totalPadded} ${totalSizePadded} ${totalGzipPadded} ${totalRatioPadded}\n`,
  );
}

function parseCliArgs(): {
  runs: number;
  warmup: number;
  includeCli: boolean;
  json: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  let runs = 5;
  let warmup = 1;
  let includeCli = false;
  let json = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--runs') {
      const val = Number.parseInt(args[++i] ?? '', 10);
      if (!Number.isNaN(val)) runs = val;
    } else if (arg.startsWith('--runs=')) {
      const val = Number.parseInt(arg.split('=')[1] ?? '', 10);
      if (!Number.isNaN(val)) runs = val;
    } else if (arg === '-w' || arg === '--warmup') {
      const val = Number.parseInt(args[++i] ?? '', 10);
      if (!Number.isNaN(val)) warmup = val;
    } else if (arg.startsWith('--warmup=')) {
      const val = Number.parseInt(arg.split('=')[1] ?? '', 10);
      if (!Number.isNaN(val)) warmup = val;
    } else if (arg === '--cli') {
      includeCli = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '-h' || arg === '--help') {
      help = true;
    }
  }

  return { runs, warmup, includeCli, json, help };
}

if (import.meta.main) {
  const opts = parseCliArgs();

  if (opts.help) {
    console.log(`
BunVite Build Benchmark CLI

Usage:
  bun bench.ts [options]
  bun run bench [options]

Options:
  -n, --runs <n>     Number of measured build iterations (default: 5)
  -w, --warmup <n>   Number of warmup build iterations (default: 1)
      --cli          Include CLI subprocess execution benchmark
      --json         Output benchmark results as JSON
  -h, --help         Show this help message
`);
    process.exit(0);
  }

  const result = await runBenchmark({
    runs: opts.runs,
    warmup: opts.warmup,
    includeCli: opts.includeCli,
    silent: opts.json,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printBenchmarkReport(result);
  }
}
