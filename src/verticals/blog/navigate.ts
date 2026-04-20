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

/** Reads AgentikasConfig.basePath and normalises it to a leading "/" + no
 *  trailing "/". Returns empty string when unset — keeping URLs identical
 *  to the no-basePath baseline. */
export function getBasePath(): string {
  if (typeof window === "undefined") return "";
  const cfg = (window as unknown as { __agentikas_config?: { basePath?: string } })
    .__agentikas_config;
  const raw = cfg?.basePath ?? "";
  if (!raw) return "";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
}

export function buildHomeUrl(locale: string = getCurrentLocale()): string {
  return `/${locale}${getBasePath()}`;
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
  const base = `/${locale}${getBasePath()}/search`;
  return qs ? `${base}?${qs}` : base;
}

export function buildPostUrl(slug: string, locale: string = getCurrentLocale()): string {
  return `/${locale}${getBasePath()}/${slug}`;
}

export function navigateTo(url: string): void {
  if (typeof window === "undefined") return;
  const cfg = (window as unknown as { __agentikas_config?: { navigate?: boolean } })
    .__agentikas_config;
  if (cfg?.navigate === false) return;
  window.location.href = url;
}

/** True when `navigateTo` would actually change window.location. Used by
 *  executors to tailor the "Opened: ..." line in tool results so the agent
 *  doesn't lie about having navigated when the consumer opted out. */
export function isNavigateEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const cfg = (window as unknown as { __agentikas_config?: { navigate?: boolean } })
    .__agentikas_config;
  return cfg?.navigate !== false;
}
