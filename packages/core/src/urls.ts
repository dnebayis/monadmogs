/**
 * Central URL configuration.
 *
 * When the API subdomain goes live, flip NEXT_PUBLIC_API_BASE_URL
 * to "https://api.monadmogs.xyz" and every internal fetch, link,
 * and llms.txt reference will follow automatically.
 */

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export const SITE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || "https://monadmogs.xyz");

export const API_BASE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || SITE_URL);

/** Build a public API path, respecting the API base URL. */
export function apiUrl(path: string) {
  return `${API_BASE_URL}${normalizePath(path)}`;
}

/** Build a site page path. */
export function siteUrl(path: string) {
  return `${SITE_URL}${normalizePath(path)}`;
}
