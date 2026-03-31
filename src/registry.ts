// @agentikas/webmcp-sdk — Vertical + Platform registry

import type {
  VerticalDefinition,
  ToolDefinition,
  AgentikasConfig,
  ExecutorMap,
  PlatformAdapter,
} from "./types";

// ── Registry ───────────────────────────────────────────────────

interface VerticalEntry {
  definition: VerticalDefinition;
  platforms: Map<string, PlatformAdapter>;
  defaultPlatform: string;
}

const verticals = new Map<string, VerticalEntry>();

/**
 * Register a vertical with its default platform.
 * The executors are wrapped into a PlatformAdapter automatically.
 */
export function registerVertical(
  definition: VerticalDefinition,
  executors: ExecutorMap,
  platformId: string = "agentikas",
): void {
  if (verticals.has(definition.id)) {
    console.warn(`[Agentikas] Vertical "${definition.id}" already registered, skipping.`);
    return;
  }

  const platforms = new Map<string, PlatformAdapter>();
  platforms.set(platformId, {
    id: platformId,
    name: platformId,
    executors,
  });

  verticals.set(definition.id, {
    definition,
    platforms,
    defaultPlatform: platformId,
  });
}

/**
 * Register an additional platform adapter for an existing vertical.
 */
export function registerPlatform(
  verticalId: string,
  adapter: PlatformAdapter,
): void {
  const entry = verticals.get(verticalId);
  if (!entry) {
    console.error(`[Agentikas] Cannot register platform "${adapter.id}": vertical "${verticalId}" not found.`);
    return;
  }
  if (entry.platforms.has(adapter.id)) {
    console.warn(`[Agentikas] Platform "${adapter.id}" already registered for vertical "${verticalId}", skipping.`);
    return;
  }
  entry.platforms.set(adapter.id, adapter);
}

export function hasVertical(id: string): boolean {
  return verticals.has(id);
}

// ── Build tools from config ────────────────────────────────────

export function buildTools(
  config: AgentikasConfig,
  data: unknown,
): ToolDefinition[] {
  const entry = verticals.get(config.vertical);
  if (!entry) {
    console.error(`[Agentikas] Unknown vertical: "${config.vertical}". Did you call initAgentikas()?`);
    return [];
  }

  const { definition } = entry;
  const activeToolNames = config.tools ?? definition.defaultTools;
  const tools: ToolDefinition[] = [];

  for (const name of activeToolNames) {
    const factory = definition.tools[name];
    if (!factory) {
      if (config.debug) {
        console.warn(`[Agentikas] Tool "${name}" not found in vertical "${config.vertical}"`);
      }
      continue;
    }
    try {
      tools.push(factory(data));
    } catch (err) {
      console.error(`[Agentikas] Error building tool "${name}":`, err);
    }
  }

  if (config.debug) {
    console.log(`[Agentikas] Built ${tools.length} tools for "${config.vertical}":`, tools.map((t) => t.name));
  }

  return tools;
}

// ── Get executors ──────────────────────────────────────────────

export function getExecutors(
  verticalId: string,
  platformId?: string,
): ExecutorMap | undefined {
  const entry = verticals.get(verticalId);
  if (!entry) return undefined;
  const pid = platformId ?? entry.defaultPlatform;
  return entry.platforms.get(pid)?.executors;
}
