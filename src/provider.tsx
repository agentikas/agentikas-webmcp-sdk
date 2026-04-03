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
    const executorMap = getExecutors(config.vertical, config.platform);
    if (!executorMap) {
      console.error(`[Agentikas] No executors for vertical "${config.vertical}" platform "${config.platform ?? "default"}"`);
      return;
    }

    const executableTools = buildExecutableTools(tools, executorMap, data, config);

    // Always expose on window
    (window as any).__agentikas_tools = executableTools;

    // Register in navigator.modelContext (WebMCP browser API)
    const mc = (navigator as any).modelContext;
    if (mc && typeof mc.registerTool === "function") {
      for (const tool of executableTools) {
        mc.registerTool(tool);
      }
    }

    if (config.debug) {
      console.log(`[Agentikas] ✓ ${executableTools.length} tools registered`);
    }
  }, [config, data, tools]);

  return null;
}
