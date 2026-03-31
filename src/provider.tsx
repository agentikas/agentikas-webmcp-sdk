"use client";

import { useEffect } from "react";
import type { ToolDefinition, AgentikasConfig } from "./types";
import { getExecutors } from "./registry";

interface WebMCPProviderProps {
  config: AgentikasConfig;
  data: unknown;
  tools: ToolDefinition[];
}

/**
 * WebMCP Provider — Generic, vertical/platform-agnostic.
 *
 * Looks up executors by vertical + platform, combines them with
 * tool definitions, and registers everything in navigator.modelContext.
 */
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
          const execute = executorFactory(data);
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
