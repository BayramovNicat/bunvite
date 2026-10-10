declare interface Window {
  __hmr_state__?: unknown;
}

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.css";

type NativeElementProps<T> = {
  [K in keyof T as T[K] extends Function ? never : K]?: T[K] extends SVGAnimatedString | SVGAnimatedRect | SVGAnimatedLength | SVGAnimatedNumber
    ? string | number
    : T[K];
} & {
  class?: string;
  className?: string;
  children?: unknown;
  autoComplete?: string;
  d?: string;
  viewBox?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string | number;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  [key: `on${string}`]: ((event: any) => void) | undefined;
  [key: `data-${string}`]: string | number | boolean | undefined;
  [key: `aria-${string}`]: string | number | boolean | undefined;
  [key: string]: unknown;
};

declare namespace JSX {
  type Element = HTMLElement | SVGElement;

  type IntrinsicElements = {
    [K in keyof HTMLElementTagNameMap]: NativeElementProps<HTMLElementTagNameMap[K]>;
  } & {
    [K in keyof SVGElementTagNameMap]: NativeElementProps<SVGElementTagNameMap[K]>;
  };
}
