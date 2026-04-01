// @agentikas/webmcp-sdk — Public API

// Core types
export type {
  AgentikasConfig,
  ToolDefinition,
  ToolFactory,
  ToolResult,
  Executor,
  ExecutorFactory,
  ExecutorMap,
  VerticalDefinition,
  PlatformAdapter,
  PlatformLoader,
} from "./types";

// Registry
export { registerVertical, registerPlatform, buildTools, getExecutors, hasVertical } from "./registry";

// Detection
export { detectPlatform, registerDetectionRule } from "./detect";

// Telemetry
export { trackToolCall } from "./telemetry";

// Provider (also available via @agentikas/webmcp-sdk/provider)
export { WebMCPProvider } from "./provider";

// ── Built-in verticals ─────────────────────────────────────────
import { registerVertical } from "./registry";
import { restaurant, restaurantExecutors } from "./verticals/restaurant";

/**
 * Initialize the SDK with built-in verticals.
 * Call once at app startup.
 */
export function initAgentikas(): void {
  registerVertical(restaurant, restaurantExecutors, "agentikas");
}
