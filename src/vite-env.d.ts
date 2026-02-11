/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GOOGLE_SHEET_ID: string
    readonly VITE_GOOGLE_API_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
