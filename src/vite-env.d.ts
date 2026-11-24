/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_DOCS_URL?: string;
  readonly VITE_PUBLIC_API_BASE_URL?: string;
  readonly VITE_BACKEND_PORT: string;
  readonly VITE_BACKEND_URL: string;
  readonly VITE_DISCORD_CLIENT_ID: string;
  readonly VITE_DISCORD_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Vuetify exposes its base stylesheet as a package entry without TS declarations.
declare module 'vuetify/styles';
