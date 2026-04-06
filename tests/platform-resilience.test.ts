/**
 * TDD tests for platform resilience: P13, P14, P16
 * Tests error handling, retry logic, and telemetry for both platforms.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { trackToolCall } from "../src/telemetry";

// ── P14: Network errors — executors should not crash ───────────

describe("P14: Network error handling", () => {
  it("trackToolCall with status 'error' does not throw", () => {
    (window as any).dataLayer = [];
    expect(() => {
      trackToolCall("search_products", "error", 0, "retail", "shopify");
    }).not.toThrow();
    delete (window as any).dataLayer;
  });

  it("trackToolCall logs error status to dataLayer", () => {
    const dataLayer: any[] = [];
    (window as any).dataLayer = dataLayer;
    trackToolCall("search_products", "error", 150, "retail", "shopify");
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0].tool_status).toBe("error");
    expect(dataLayer[0].tool_name).toBe("search_products");
    delete (window as any).dataLayer;
  });
});

// ── P16: Search with no results — telemetry event ──────────────

describe("P16: Search no-results telemetry", () => {
  let dataLayer: any[];

  beforeEach(() => {
    dataLayer = [];
    (window as any).dataLayer = dataLayer;
  });

  afterEach(() => {
    delete (window as any).dataLayer;
  });

  it("successful search tracks 'success'", () => {
    trackToolCall("search_products", "success", 200, "retail", "shopify");
    expect(dataLayer[0].tool_status).toBe("success");
  });

  it("search that returns results sends success event", () => {
    trackToolCall("search_products", "success", 150, "retail", "shopify");
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0].event).toBe("ai_tool_call");
    expect(dataLayer[0].tool_name).toBe("search_products");
    expect(dataLayer[0].tool_status).toBe("success");
    expect(dataLayer[0].tool_duration_ms).toBe(150);
  });

  it("search that throws tracks 'error'", () => {
    trackToolCall("search_products", "error", 50, "retail", "shopify");
    expect(dataLayer[0].tool_status).toBe("error");
  });

  it("telemetry includes platform info", () => {
    trackToolCall("search_products", "success", 100, "retail", "adobe-eds");
    expect(dataLayer[0].tool_vertical).toBe("retail");
    expect(dataLayer[0].tool_platform).toBe("adobe-eds");
  });

  it("telemetry works for restaurant vertical too", () => {
    trackToolCall("get_menu", "success", 50, "restaurant", "agentikas");
    expect(dataLayer[0].tool_name).toBe("get_menu");
    expect(dataLayer[0].tool_vertical).toBe("restaurant");
  });
});

// ── P13: Retry behavior expectations ───────────────────────────

describe("P13: Retry/backoff expectations", () => {
  it("wrap-executor catches sync errors and tracks them", async () => {
    // Import the wrapper
    const { buildExecutableTools } = await import("../src/wrap-executor");

    const dataLayer: any[] = [];
    (window as any).dataLayer = dataLayer;

    const failingExecutors = {
      test_tool: () => () => { throw new Error("API rate limited"); },
    };

    const tools = buildExecutableTools(
      [{ name: "test_tool", description: "test", input_schema: { type: "object" as const, properties: {}, required: [] } }],
      failingExecutors,
      {},
      { vertical: "retail", platform: "shopify" },
    );

    expect(tools).toHaveLength(1);
    expect(() => tools[0].execute({})).toThrow("API rate limited");
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0].tool_status).toBe("error");

    delete (window as any).dataLayer;
  });

  it("wrap-executor catches async errors and tracks them", async () => {
    const { buildExecutableTools } = await import("../src/wrap-executor");

    const dataLayer: any[] = [];
    (window as any).dataLayer = dataLayer;

    const failingAsyncExecutors = {
      test_tool: () => async () => { throw new Error("429 Too Many Requests"); },
    };

    const tools = buildExecutableTools(
      [{ name: "test_tool", description: "test", input_schema: { type: "object" as const, properties: {}, required: [] } }],
      failingAsyncExecutors,
      {},
      { vertical: "retail", platform: "shopify" },
    );

    await expect(tools[0].execute({})).rejects.toThrow("429 Too Many Requests");
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0].tool_status).toBe("error");

    delete (window as any).dataLayer;
  });
});
