// @agentikas/webmcp-sdk — Navigation helpers for the Blog vertical.
// Tools that return multi-post info navigate to /search; tools that
// resolve a single post navigate to its detail. All navigation is
// opt-out via __agentikas_config.navigate === false.

const LOCALE_PATTERN = /^[a-z]{2}$/;
const DEFAULT_LOCALE = "es";

export function getCurrentLocale(): string {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const first = new URL(document.baseURI).pathname.split("/").filter(Boolean)[0];
  return first && LOCALE_PATTERN.test(first) ? first : DEFAULT_LOCALE;
}

export function buildHomeUrl(locale: string = getCurrentLocale()): string {
  return `/${locale}`;
}

export interface SearchParams {
  q?: string;
  tag?: string;
  author?: string;
  sort?: string;
}

export function buildSearchUrl(
  params: SearchParams = {},
  locale: string = getCurrentLocale(),
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `/${locale}/search?${qs}` : `/${locale}/search`;
}

export function buildPostUrl(slug: string, locale: string = getCurrentLocale()): string {
  return `/${locale}/${slug}`;
}

export function navigateTo(url: string): void {
  if (typeof window === "undefined") return;
  const cfg = (window as unknown as { __agentikas_config?: { navigate?: boolean } })
    .__agentikas_config;
  if (cfg?.navigate === false) return;
  window.location.href = url;
}
