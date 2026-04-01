// @agentikas/webmcp-sdk — GA4 telemetry via dataLayer

/**
 * Push a tool call event to GA4 via dataLayer.
 * Works if GTM is installed. Silent no-op if not.
 *
 * Events appear in GA4 as custom events:
 *   ai_tool_call { tool_name, tool_status, tool_duration_ms, tool_vertical, tool_platform }
 */
export function trackToolCall(
  toolName: string,
  status: "success" | "error",
  durationMs: number,
  vertical: string,
  platform: string | undefined,
): void {
  const w = globalThis.window;
  if (!w) return;

  const dataLayer = (w as any).dataLayer;
  if (!dataLayer) return;

  dataLayer.push({
    event: "ai_tool_call",
    tool_name: toolName,
    tool_status: status,
    tool_duration_ms: Math.round(durationMs),
    tool_vertical: vertical,
    tool_platform: platform ?? "unknown",
  });
}
