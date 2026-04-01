import { describe, it, expect, vi, beforeEach } from "vitest";

// Each test uses vi.resetModules() + dynamic import() so the module-level
// `rules` array starts fresh (no cross-test pollution).

async function freshModule() {
  vi.resetModules();
  return import("../src/detect");
}

describe("detectPlatform", () => {
  it("returns 'generic' with no rules", async () => {
    const { detectPlatform } = await freshModule();
    expect(detectPlatform()).toBe("generic");
  });

  it("returns first matching platform", async () => {
    const { detectPlatform, registerDetectionRule } = await freshModule();

    registerDetectionRule({ platformId: "shopify", detect: () => false });
    registerDetectionRule({ platformId: "wordpress", detect: () => true });
    registerDetectionRule({ platformId: "wix", detect: () => true });

    expect(detectPlatform()).toBe("wordpress");
  });

  it("skips rules that throw", async () => {
    const { detectPlatform, registerDetectionRule } = await freshModule();

    registerDetectionRule({
      platformId: "broken",
      detect: () => {
        throw new Error("kaboom");
      },
    });
    registerDetectionRule({ platformId: "fallback", detect: () => true });

    expect(detectPlatform()).toBe("fallback");
  });

  it("returns 'generic' when no rules match", async () => {
    const { detectPlatform, registerDetectionRule } = await freshModule();

    registerDetectionRule({ platformId: "a", detect: () => false });
    registerDetectionRule({ platformId: "b", detect: () => false });

    expect(detectPlatform()).toBe("generic");
  });
});

describe("registerDetectionRule", () => {
  it("adds rules that are used by detectPlatform", async () => {
    const { detectPlatform, registerDetectionRule } = await freshModule();

    // starts empty -> generic
    expect(detectPlatform()).toBe("generic");

    registerDetectionRule({ platformId: "added", detect: () => true });
    expect(detectPlatform()).toBe("added");
  });
});
