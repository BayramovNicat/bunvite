declare interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly [key: `VITE_${string}`]: string | undefined;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
