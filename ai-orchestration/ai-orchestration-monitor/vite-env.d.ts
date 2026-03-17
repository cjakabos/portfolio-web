/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_BASE_URL?: string;
  readonly VITE_AI_WS_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_REQUEST_TIMEOUT?: string;
  readonly VITE_AI_PATH?: string;
  readonly VITE_CLOUDAPP_ADMIN_PATH?: string;
  readonly VITE_CLOUDAPP_PUBLIC_PATH?: string;
  readonly VITE_PETSTORE_PATH?: string;
  readonly VITE_VEHICLES_PATH?: string;
  readonly VITE_ML_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
