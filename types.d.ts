declare namespace Bun {
  class WebView extends EventTarget {
    constructor(options?: { width?: number; height?: number });
    navigate(url: string): Promise<void>;
    evaluate<T = any>(script: string): Promise<T>;
    screenshot(): Promise<Blob>;
    click(selector: string): Promise<void>;
    type(text: string): Promise<void>;
    press(key: string): Promise<void>;
    scroll(x: number, y: number): Promise<void>;
    scrollTo(x: number, y: number): Promise<void>;
    resize(width: number, height: number): Promise<void>;
    goBack(): Promise<void>;
    goForward(): Promise<void>;
    reload(): Promise<void>;
    close(): Promise<void>;
    readonly url: string;
    readonly title: string;
    readonly loading: boolean;
    [Symbol.asyncDispose](): Promise<void>;
    [Symbol.dispose](): void;
  }
}
