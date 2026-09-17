declare type Timer = ReturnType<typeof setTimeout>;

declare interface ImportMeta {
  dir: string;
  main: boolean;
}

declare module 'bun' {
  export interface Server<T = unknown> {
    port: number;
    stop(closeActiveConnections?: boolean): void;
    upgrade(req: Request, options?: { data?: T }): boolean;
  }
  export interface ServerWebSocket<T = unknown> {
    send(data: string | ArrayBufferView | ArrayBuffer): void;
    data: T;
  }
  export interface BunFile {
    exists(): Promise<boolean>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    size: number;
    type: string;
    stat(): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
    delete(): Promise<void>;
  }
  export function file(path: string): BunFile;
  export interface ServeOptions<T = unknown> {
    port?: number | string;
    hostname?: string;
    fetch?(req: Request, server: Server<T>): Response | Promise<Response | undefined> | undefined;
    websocket?: {
      open?(ws: ServerWebSocket<T>): void;
      message?(ws: ServerWebSocket<T>, message: unknown): void;
      close?(ws: ServerWebSocket<T>): void;
    };
    [key: string]: unknown;
  }
  export function serve<T = unknown>(options: ServeOptions<T>): Server<T>;
}

declare module 'bun:test' {
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function expect(value: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toBeNull(): void;
    not: {
      toBeNull(): void;
      toBeUndefined(): void;
      toContain(expected: string): void;
    };
    toContain(expected: string): void;
    toMatch(expected: RegExp): void;
  };
}

declare namespace Bun {
  export interface WebView {
    navigate(url: string): Promise<void>;
    evaluate<T = unknown>(code: string): Promise<T>;
    close(): Promise<void>;
  }
  export var WebView: {
    new (): WebView;
  };
  export function file(path: string): import('bun').BunFile;
  export function write(destination: string, input: unknown): Promise<number>;
  export function hash(input: string | ArrayBufferView | ArrayBuffer): bigint;
  export function gzipSync(input: Uint8Array): Uint8Array;
  export function spawn(
    command: string[],
    options?: {
      cwd?: string;
      env?: Record<string, string | undefined>;
      stdout?: 'inherit' | 'pipe' | 'ignore';
      stderr?: 'inherit' | 'pipe' | 'ignore';
    },
  ): {
    exited: Promise<number>;
    stdout: ReadableStream;
    stderr: ReadableStream;
    exitCode?: number;
    unref(): void;
  };
  export function serve<T = unknown>(
    options: import('bun').ServeOptions<T>,
  ): import('bun').Server<T>;
  export function which(name: string): string | null;
  export function build(options: unknown): Promise<{
    success: boolean;
    outputs: Array<{ path: string; text(): Promise<string> }>;
    logs: Array<{ message?: string }>;
  }>;
}

declare var process: {
  env: Record<string, string | undefined>;
  platform: string;
  arch: string;
  argv: string[];
  exit(code?: number): never;
};

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function watch(
    path: string,
    options: unknown,
    listener: (event: string, filename: string) => void,
  ): unknown;
}

declare module 'node:fs/promises' {
  export function cp(src: string, dest: string, options?: unknown): Promise<void>;
  export function mkdir(path: string, options?: unknown): Promise<string | undefined>;
  export function readdir(path: string, options?: unknown): Promise<string[]>;
  export function rm(path: string, options?: unknown): Promise<void>;
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
  export function basename(path: string, ext?: string): string;
}

declare module 'node:os' {
  export function networkInterfaces(): Record<
    string,
    Array<{ family: string; internal: boolean; address: string }> | undefined
  >;
}
