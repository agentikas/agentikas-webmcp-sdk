// @agentikas/webmcp-sdk — Executor wrapper with telemetry
// Shared by loader.ts and provider.tsx. Handles both sync and async executors.

import type { Executor, ExecutorMap, ToolDefinition } from "./types";
import { trackToolCall } from "./telemetry";

interface ExecutableToolConfig {
  vertical: string;
  platform?: string;
  debug?: boolean;
}

interface ExecutableTool {
  name: string;
  description: string;
  inputSchema: ToolDefinition["input_schema"];
  execute: Executor;
}

/**
 * Wrap an executor with telemetry tracking.
 * Handles both sync and async executors correctly.
 */
function wrapWithTelemetry(
  toolName: string,
  rawExecute: Executor,
  config: ExecutableToolConfig,
): Executor {
  return (args: any) => {
    const start = performance.now();
    try {
      const result = rawExecute(args);

      // Handle async executors (Shopify, WooCommerce, Adobe, etc.)
      if (result && typeof (result as any).then === "function") {
        return (result as Promise<any>).then(
          (resolved) => {
            trackToolCall(toolName, "success", performance.now() - start, config.vertical, config.platform);
            return resolved;
          },
          (err) => {
            trackToolCall(toolName, "error", performance.now() - start, config.vertical, config.platform);
            throw err;
          },
        );
      }

      // Sync executor
      trackToolCall(toolName, "success", performance.now() - start, config.vertical, config.platform);
      return result;
    } catch (err) {
      trackToolCall(toolName, "error", performance.now() - start, config.vertical, config.platform);
      throw err;
    }
  };
}

/**
 * Build executable tools from definitions + executors + telemetry.
 * Used by both loader.ts (standalone script) and provider.tsx (React).
 */
export function buildExecutableTools(
  tools: ToolDefinition[],
  executorMap: ExecutorMap,
  data: unknown,
  config: ExecutableToolConfig,
): ExecutableTool[] {
  return tools
    .map((tool) => {
      const executorFactory = executorMap[tool.name];
      if (!executorFactory) {
        if (config.debug) {
          console.warn(`[Agentikas] No executor for tool "${tool.name}"`);
        }
        return null;
      }
      try {
        const rawExecute = executorFactory(data);
        const execute = wrapWithTelemetry(tool.name, rawExecute, config);
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.input_schema,
          execute,
        };
      } catch (err) {
        console.error(`[Agentikas] Error creating executor for "${tool.name}":`, err);
        return null;
      }
    })
    .filter((t): t is ExecutableTool => t !== null);
}
