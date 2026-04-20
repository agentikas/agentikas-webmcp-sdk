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

function normalisePath(raw: string): string {
  if (!raw) return "";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
}

/** Derive basePath from the Atom feed discovery link. The feed lives at
 *  `/{locale}{basePath}/feed.xml` by convention, so whatever segments sit
 *  between the locale and `feed.xml` ARE the basePath. Returns "" when the
 *  link is missing or the path doesn't match the convention. */
function basePathFromFeed(): string {
  if (typeof document === "undefined") return "";
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="alternate"][type="application/atom+xml"]',
  );
  if (!link?.href) return "";
  try {
    const pathname = new URL(link.href).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last !== "feed.xml") return "";
    const middle = segments.slice(1, -1);
    return middle.length > 0 ? `/${middle.join("/")}` : "";
  } catch {
    return "";
  }
}

/** Resolve the navigation basePath. Priority: explicit AgentikasConfig
 *  override → auto-derive from the Atom feed link → empty (root-mounted).
 *
 *  Auto-deriving means surfaces like `agentikas.ai/en/blog` need no inline
 *  config: the feed URL (`/en/blog/feed.xml`) already encodes the sub-route,
 *  and Next's Script component cannot reliably inject inline config before
 *  an async CDN script executes from a nested layout. */
export function getBasePath(): string {
  if (typeof window === "undefined") return "";
  const cfg = (window as unknown as { __agentikas_config?: { basePath?: string } })
    .__agentikas_config;
  if (cfg?.basePath !== undefined) {
    return normalisePath(cfg.basePath);
  }
  return basePathFromFeed();
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
