// @agentikas/webmcp-sdk — Core types

// ── Config ─────────────────────────────────────────────────────

export interface AgentikasConfig {
  businessId: string;
  vertical: string;
  platform?: string;
  apiBase?: string;
  tools?: string[];
  debug?: boolean;
}

// ── Tool Definition ────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, {
      type: "string" | "number" | "boolean" | "array" | "object";
      description: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
}

// ── Tool Factory ───────────────────────────────────────────────

export type ToolFactory<TData = any> = (data: TData) => ToolDefinition;

// ── Executor ───────────────────────────────────────────────────

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export type Executor = (args: any) => ToolResult | Promise<ToolResult>;
export type ExecutorFactory<TData = any> = (data: TData) => Executor;
export type ExecutorMap<TData = any> = Record<string, ExecutorFactory<TData>>;

// ── Vertical ───────────────────────────────────────────────────

export interface VerticalDefinition<TData = any> {
  id: string;
  name: string;
  tools: Record<string, ToolFactory<TData>>;
  defaultTools: string[];
}

// ── Platform ───────────────────────────────────────────────────

export interface PlatformAdapter<TData = any> {
  id: string;
  name: string;
  detect?: () => boolean;
  executors: ExecutorMap<TData>;
}

export type PlatformLoader<TData = any> = () => Promise<PlatformAdapter<TData>>;
