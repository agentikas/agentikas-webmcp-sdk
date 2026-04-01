import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  VerticalDefinition,
  ExecutorMap,
  PlatformAdapter,
  AgentikasConfig,
} from "../src/types";
import {
  registerVertical,
  registerPlatform,
  hasVertical,
  buildTools,
  getExecutors,
} from "../src/registry";

// ── helpers ───────────────────────────────────────────────────

let uid = 0;
function uniqueId(prefix = "v") {
  return `${prefix}-${++uid}-${Date.now()}`;
}

function makeDef(
  id: string,
  toolNames: string[] = ["toolA", "toolB"],
  defaultTools?: string[],
): VerticalDefinition {
  const tools: Record<string, (data: any) => any> = {};
  for (const t of toolNames) {
    tools[t] = (_data: any) => ({
      name: t,
      description: `${t} description`,
      input_schema: { type: "object" as const, properties: {} },
    });
  }
  return {
    id,
    name: id,
    tools,
    defaultTools: defaultTools ?? toolNames,
  };
}

function makeExecutors(...names: string[]): ExecutorMap {
  const map: ExecutorMap = {};
  for (const n of names) {
    map[n] = (_data: any) => (_args: any) => ({
      content: [{ type: "text" as const, text: n }],
    });
  }
  return map;
}

// ── registerVertical ──────────────────────────────────────────

describe("registerVertical", () => {
  it("registers with default platform", () => {
    const id = uniqueId();
    const def = makeDef(id);
    registerVertical(def, makeExecutors("toolA"));
    expect(hasVertical(id)).toBe(true);
  });

  it("warns and skips duplicates", () => {
    const id = uniqueId();
    const def = makeDef(id);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    registerVertical(def, makeExecutors("toolA"));
    registerVertical(def, makeExecutors("toolA")); // duplicate

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(`Vertical "${id}" already registered`),
    );
    warn.mockRestore();
  });
});

// ── registerPlatform ──────────────────────────────────────────

describe("registerPlatform", () => {
  it("adds to existing vertical", () => {
    const id = uniqueId();
    registerVertical(makeDef(id), makeExecutors("toolA"));

    const adapter: PlatformAdapter = {
      id: "shopify",
      name: "Shopify",
      executors: makeExecutors("toolA"),
    };
    registerPlatform(id, adapter);

    // verify executors are reachable via the new platform
    expect(getExecutors(id, "shopify")).toBeDefined();
  });

  it("errors for unknown vertical", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    registerPlatform("nonexistent-" + uniqueId(), {
      id: "x",
      name: "X",
      executors: {},
    });

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("vertical"),
      // message also contains "not found"
    );
    error.mockRestore();
  });

  it("warns for duplicate platform", () => {
    const id = uniqueId();
    registerVertical(makeDef(id), makeExecutors("toolA"));

    const adapter: PlatformAdapter = {
      id: "dup-plat",
      name: "Dup",
      executors: makeExecutors("toolA"),
    };
    registerPlatform(id, adapter);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    registerPlatform(id, adapter); // duplicate
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(`Platform "dup-plat" already registered`),
    );
    warn.mockRestore();
  });
});

// ── hasVertical ───────────────────────────────────────────────

describe("hasVertical", () => {
  it("returns true for registered vertical", () => {
    const id = uniqueId();
    registerVertical(makeDef(id), makeExecutors("toolA"));
    expect(hasVertical(id)).toBe(true);
  });

  it("returns false for unknown vertical", () => {
    expect(hasVertical("unknown-" + uniqueId())).toBe(false);
  });
});

// ── buildTools ────────────────────────────────────────────────

describe("buildTools", () => {
  it("builds all default tools", () => {
    const id = uniqueId();
    registerVertical(makeDef(id, ["a", "b"], ["a", "b"]), makeExecutors("a", "b"));

    const config: AgentikasConfig = { businessId: "biz", vertical: id };
    const tools = buildTools(config, {});

    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(["a", "b"]);
  });

  it("returns empty for unknown vertical", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const config: AgentikasConfig = {
      businessId: "biz",
      vertical: "no-such-" + uniqueId(),
    };
    const tools = buildTools(config, {});

    expect(tools).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Unknown vertical"),
    );
    error.mockRestore();
  });

  it("respects config.tools selection", () => {
    const id = uniqueId();
    registerVertical(
      makeDef(id, ["x", "y", "z"], ["x", "y", "z"]),
      makeExecutors("x", "y", "z"),
    );

    const config: AgentikasConfig = {
      businessId: "biz",
      vertical: id,
      tools: ["y"],
    };
    const tools = buildTools(config, {});

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("y");
  });

  it("uses defaultTools when config.tools omitted", () => {
    const id = uniqueId();
    registerVertical(
      makeDef(id, ["m", "n", "o"], ["m", "o"]),
      makeExecutors("m", "n", "o"),
    );

    const config: AgentikasConfig = { businessId: "biz", vertical: id };
    const tools = buildTools(config, {});

    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(["m", "o"]);
  });

  it("catches factory errors", () => {
    const id = uniqueId();
    const def = makeDef(id, ["good"], ["good"]);
    // override "good" to throw
    def.tools["good"] = () => {
      throw new Error("boom");
    };
    registerVertical(def, makeExecutors("good"));

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const config: AgentikasConfig = { businessId: "biz", vertical: id };
    const tools = buildTools(config, {});

    expect(tools).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Error building tool "good"'),
      expect.any(Error),
    );
    error.mockRestore();
  });

  it("logs debug when config.debug is true", () => {
    const id = uniqueId();
    registerVertical(makeDef(id, ["d1"], ["d1"]), makeExecutors("d1"));

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const config: AgentikasConfig = {
      businessId: "biz",
      vertical: id,
      debug: true,
    };
    buildTools(config, {});

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Built 1 tools"),
      expect.any(Array),
    );
    log.mockRestore();
  });
});

// ── getExecutors ──────────────────────────────────────────────

describe("getExecutors", () => {
  it("returns executors for default platform", () => {
    const id = uniqueId();
    registerVertical(makeDef(id), makeExecutors("toolA"));
    const execs = getExecutors(id);
    expect(execs).toBeDefined();
    expect(execs).toHaveProperty("toolA");
  });

  it("returns executors for specific platform", () => {
    const id = uniqueId();
    registerVertical(makeDef(id), makeExecutors("toolA"));
    registerPlatform(id, {
      id: "custom",
      name: "Custom",
      executors: makeExecutors("toolB"),
    });
    const execs = getExecutors(id, "custom");
    expect(execs).toBeDefined();
    expect(execs).toHaveProperty("toolB");
  });

  it("returns undefined for unknown vertical", () => {
    expect(getExecutors("nope-" + uniqueId())).toBeUndefined();
  });
});
