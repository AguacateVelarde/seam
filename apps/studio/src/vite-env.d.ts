/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SEAM_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
