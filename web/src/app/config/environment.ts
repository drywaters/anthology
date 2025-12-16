const meta =
    typeof document !== 'undefined' ? document.querySelector('meta[name="anthology-api"]') : null;
const metaUrl = meta?.getAttribute('content')?.trim() || null;
const globalUrl = (globalThis as { NG_APP_API_URL?: string }).NG_APP_API_URL?.trim() || null;
const locationOrigin = typeof window !== 'undefined' ? `${window.location.origin}/api` : null;

const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
const safeMetaUrl = isHttpsPage && metaUrl?.startsWith('http:') ? null : metaUrl;
const fallbackUrl = isHttpsPage ? locationOrigin : 'http://localhost:8080/api';

// Allow hosts to override the API URL via a global before falling back to the baked-in meta tag.
export const environment = {
    apiUrl: globalUrl || safeMetaUrl || fallbackUrl || 'http://localhost:8080/api',
};
