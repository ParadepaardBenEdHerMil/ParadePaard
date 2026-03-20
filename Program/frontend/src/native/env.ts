const FALLBACK_API_BASE_URL = "http://localhost:4004";

export function getApiBaseUrl(): string {
    const viteEnv =
        (globalThis as { importMetaEnv?: { VITE_API_BASE_URL?: string } }).importMetaEnv
            ?.VITE_API_BASE_URL;
    if (viteEnv) return viteEnv;

    const processEnv =
        (globalThis as { process?: { env?: { VITE_API_BASE_URL?: string; API_BASE_URL?: string } } })
            .process?.env;
    if (processEnv?.VITE_API_BASE_URL) return processEnv.VITE_API_BASE_URL;
    if (processEnv?.API_BASE_URL) return processEnv.API_BASE_URL;

    return FALLBACK_API_BASE_URL;
}
