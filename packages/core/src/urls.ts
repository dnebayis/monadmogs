/**
 * Central URL configuration.
 *
 * The frontend and API deploy as separate Vercel projects.
 * Keep page links on SITE_URL and machine/API routes on API_BASE_URL.
 */

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export const SITE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || "https://www.monadmogs.xyz");

export const API_BASE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.monadmogs.xyz");

/** Build a public API path, respecting the API base URL. */
export function apiUrl(path: string) {
  return `${API_BASE_URL}${normalizePath(path)}`;
}

/** Build a site page path. */
export function siteUrl(path: string) {
  return `${SITE_URL}${normalizePath(path)}`;
}
