import { describe, expect, test } from 'bun:test';
import {
  calculateStats,
  formatBytes,
  formatMs,
  runBenchmark,
} from '../../bench';

describe('benchmark engine', () => {
  test('calculates statistics accurately', () => {
    const empty = calculateStats([]);
    expect(empty.min).toBe(0);
    expect(empty.max).toBe(0);
    expect(empty.mean).toBe(0);
    expect(empty.median).toBe(0);
    expect(empty.stdDev).toBe(0);

    const stats = calculateStats([10, 20, 30, 40, 50]);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
    expect(stats.mean).toBe(30);
    expect(stats.median).toBe(30);
    expect(stats.p95).toBe(50);
    expect(Math.round(stats.stdDev * 100) / 100).toBe(14.14);

    const evenStats = calculateStats([10, 20, 30, 40]);
    expect(evenStats.median).toBe(25);
  });

  test('formats bytes and durations properly', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1.00 kB');
    expect(formatBytes(2048)).toBe('2.00 kB');
    expect(formatMs(123.456)).toBe('123.5 ms');
  });

  test('executes in-process benchmark programmatically', async () => {
    const result = await runBenchmark({
      runs: 1,
      warmup: 0,
      silent: true,
    });

    expect(result.config.runs).toBe(1);
    expect(result.config.warmup).toBe(0);
    expect(result.inProcess.stats.samples.length).toBe(1);
    expect(result.inProcess.stats.mean).toBeGreaterThan(0);

    expect(result.inProcess.stages.setup.mean).toBeGreaterThanOrEqual(0);
    expect(result.inProcess.stages.js.mean).toBeGreaterThan(0);
    expect(result.inProcess.stages.css.mean).toBeGreaterThan(0);
    expect(result.inProcess.stages.html.mean).toBeGreaterThan(0);
    expect(result.inProcess.stages.summary.mean).toBeGreaterThan(0);

    expect(result.artifacts.length).toBeGreaterThan(0);
    expect(result.totals.size).toBeGreaterThan(0);
    expect(result.totals.gzip).toBeGreaterThan(0);
  });

  test('supports CLI subprocess execution with json output', async () => {
    const proc = Bun.spawn(['bun', 'bench.ts', '-n', '1', '-w', '0', '--json'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.config.runs).toBe(1);
    expect(parsed.config.warmup).toBe(0);
    expect(parsed.inProcess.stats.samples.length).toBe(1);
    expect(parsed.artifacts.length).toBeGreaterThan(0);
  });
});
