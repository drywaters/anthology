const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="anthology-api"]') : null;
const metaUrl = meta?.getAttribute('content')?.trim();
const globalUrl = (globalThis as { NG_APP_API_URL?: string }).NG_APP_API_URL;

export const environment = {
  apiUrl: metaUrl || globalUrl || 'http://localhost:8080/api'
};
