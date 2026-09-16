/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_PDI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
