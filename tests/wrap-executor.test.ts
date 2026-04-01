import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildExecutableTools } from "../src/wrap-executor";
import type { ToolDefinition, ExecutorMap } from "../src/types";

const mockTool: ToolDefinition = {
  name: "test_tool",
  description: "A test tool",
  input_schema: { type: "object", properties: {}, required: [] },
};

describe("buildExecutableTools", () => {
  it("creates executable tools from definitions + executors", () => {
    const executors: ExecutorMap = {
      test_tool: () => () => ({ content: [{ type: "text", text: "ok" }] }),
    };
    const result = buildExecutableTools([mockTool], executors, {}, { vertical: "test" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("test_tool");
    expect(result[0].execute({})).toEqual({ content: [{ type: "text", text: "ok" }] });
  });

  it("skips tools without matching executor", () => {
    const result = buildExecutableTools([mockTool], {}, {}, { vertical: "test" });
    expect(result).toHaveLength(0);
  });

  it("catches executor factory errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const executors: ExecutorMap = {
      test_tool: () => { throw new Error("factory broke"); },
    };
    const result = buildExecutableTools([mockTool], executors, {}, { vertical: "test" });
    expect(result).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("sync telemetry wrapper", () => {
  let dataLayer: any[];

  beforeEach(() => {
    dataLayer = [];
    (window as any).dataLayer = dataLayer;
  });

  afterEach(() => {
    delete (window as any).dataLayer;
  });

  it("tracks success for sync executor", () => {
    const executors: ExecutorMap = {
      test_tool: () => () => ({ content: [{ type: "text", text: "ok" }] }),
    };
    const tools = buildExecutableTools([mockTool], executors, {}, { vertical: "v", platform: "p" });
    tools[0].execute({});
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0].event).toBe("ai_tool_call");
    expect(dataLayer[0].tool_name).toBe("test_tool");
    expect(dataLayer[0].tool_status).toBe("success");
  });

  it("tracks error for sync executor that throws", () => {
    const executors: ExecutorMap = {
      test_tool: () => () => { throw new Error("boom"); },
    };
    const tools = buildExecutableTools([mockTool], executors, {}, { vertical: "v", platform: "p" });
    expect(() => tools[0].execute({})).toThrow("boom");
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0].tool_status).toBe("error");
  });
});

describe("async telemetry wrapper", () => {
  let dataLayer: any[];

  beforeEach(() => {
    dataLayer = [];
    (window as any).dataLayer = dataLayer;
  });

  afterEach(() => {
    delete (window as any).dataLayer;
  });

  it("tracks success for async executor", async () => {
    const executors: ExecutorMap = {
      test_tool: () => async () => ({ content: [{ type: "text", text: "async ok" }] }),
    };
    const tools = buildExecutableTools([mockTool], executors, {}, { vertical: "v", platform: "p" });
    const result = await tools[0].execute({});
    expect(result).toEqual({ content: [{ type: "text", text: "async ok" }] });
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0].tool_status).toBe("success");
    expect(dataLayer[0].tool_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("tracks error for async executor that rejects", async () => {
    const executors: ExecutorMap = {
      test_tool: () => async () => { throw new Error("async boom"); },
    };
    const tools = buildExecutableTools([mockTool], executors, {}, { vertical: "v", platform: "p" });
    await expect(tools[0].execute({})).rejects.toThrow("async boom");
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0].tool_status).toBe("error");
  });

  it("measures actual async duration (not just promise creation)", async () => {
    const executors: ExecutorMap = {
      test_tool: () => async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { content: [{ type: "text", text: "delayed" }] };
      },
    };
    const tools = buildExecutableTools([mockTool], executors, {}, { vertical: "v", platform: "p" });
    await tools[0].execute({});
    expect(dataLayer[0].tool_duration_ms).toBeGreaterThanOrEqual(40);
  });
});
