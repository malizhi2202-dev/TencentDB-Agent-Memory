/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** KS（Knowledge Service）直连地址，代码分析工具统一通道（默认 http://127.0.0.1:8421） */
  readonly VITE_KS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
