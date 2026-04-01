"use client";

import { useEffect } from "react";
import type { ToolDefinition, AgentikasConfig } from "./types";
import { getExecutors } from "./registry";
import { buildExecutableTools } from "./wrap-executor";

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

    const executableTools = buildExecutableTools(tools, executorMap, data, config);
    modelContext.provideContext({ tools: executableTools });

    if (config.debug) {
      console.log(`[Agentikas] Provided ${executableTools.length} tools to modelContext`);
    }
  }, [config, data, tools]);

  return null;
}
