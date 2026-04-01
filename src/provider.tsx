"use client";

import { useEffect } from "react";
import type { ToolDefinition, AgentikasConfig } from "./types";
import { getExecutors } from "./registry";
import { trackToolCall } from "./telemetry";

interface WebMCPProviderProps {
  config: AgentikasConfig;
  data: unknown;
  tools: ToolDefinition[];
}

export function WebMCPProvider({ config, data, tools }: WebMCPProviderProps) {
  useEffect(() => {
    if (!("modelContext" in window.navigator)) return;

    const modelContext = (
      window.navigator as Navigator & {
        modelContext: {
          provideContext: (ctx: { tools: unknown[] }) => void;
        };
      }
    ).modelContext;

    const executorMap = getExecutors(config.vertical, config.platform);
    if (!executorMap) {
      console.error(`[Agentikas] No executors for vertical "${config.vertical}" platform "${config.platform ?? "default"}"`);
      return;
    }

    const executableTools = tools
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

          // Wrap executor with GA4 telemetry
          const execute = (args: any) => {
            const start = performance.now();
            try {
              const result = rawExecute(args);
              trackToolCall(tool.name, "success", performance.now() - start, config.vertical, config.platform);
              return result;
            } catch (err) {
              trackToolCall(tool.name, "error", performance.now() - start, config.vertical, config.platform);
              throw err;
            }
          };

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
      .filter(Boolean);

    modelContext.provideContext({ tools: executableTools });

    if (config.debug) {
      console.log(`[Agentikas] Provided ${executableTools.length} tools to modelContext`);
    }
  }, [config, data, tools]);

  return null;
}
