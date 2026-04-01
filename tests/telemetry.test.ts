import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { trackToolCall } from "../src/telemetry";

describe("trackToolCall", () => {
  let origDataLayer: any;

  beforeEach(() => {
    // ensure window exists (jsdom provides it)
    origDataLayer = (window as any).dataLayer;
    (window as any).dataLayer = [];
  });

  afterEach(() => {
    if (origDataLayer === undefined) {
      delete (window as any).dataLayer;
    } else {
      (window as any).dataLayer = origDataLayer;
    }
  });

  it("pushes event to dataLayer", () => {
    trackToolCall("getMenu", "success", 123, "hospitality", "agentikas");
    expect((window as any).dataLayer).toHaveLength(1);
  });

  it("includes correct properties", () => {
    trackToolCall("getMenu", "success", 42, "hospitality", "shopify");

    const event = (window as any).dataLayer[0];
    expect(event).toEqual({
      event: "ai_tool_call",
      tool_name: "getMenu",
      tool_status: "success",
      tool_duration_ms: 42,
      tool_vertical: "hospitality",
      tool_platform: "shopify",
    });
  });

  it("rounds duration", () => {
    trackToolCall("getMenu", "error", 99.7, "hospitality", "agentikas");

    const event = (window as any).dataLayer[0];
    expect(event.tool_duration_ms).toBe(100);
  });

  it("uses 'unknown' when platform is undefined", () => {
    trackToolCall("getMenu", "success", 10, "hospitality", undefined);

    const event = (window as any).dataLayer[0];
    expect(event.tool_platform).toBe("unknown");
  });

  it("no-op without dataLayer", () => {
    delete (window as any).dataLayer;

    // should not throw
    expect(() =>
      trackToolCall("getMenu", "success", 10, "hospitality", "agentikas"),
    ).not.toThrow();
  });

  it("no-op in SSR (no window)", () => {
    // Temporarily remove globalThis.window to simulate SSR
    const origWindow = globalThis.window;
    // @ts-expect-error -- deliberately removing window for SSR simulation
    delete globalThis.window;

    try {
      expect(() =>
        trackToolCall("getMenu", "success", 10, "hospitality", "agentikas"),
      ).not.toThrow();
    } finally {
      globalThis.window = origWindow;
    }
  });
});
