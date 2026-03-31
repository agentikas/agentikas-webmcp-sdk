// @agentikas/webmcp-sdk — Platform auto-detection
// Used by the GTM loader to detect which platform a website runs on.

export interface DetectionRule {
  platformId: string;
  detect: () => boolean;
}

const rules: DetectionRule[] = [];

export function registerDetectionRule(rule: DetectionRule): void {
  rules.push(rule);
}

/**
 * Run all registered detection rules in order.
 * Returns the first matching platform ID, or 'generic' as fallback.
 */
export function detectPlatform(): string {
  for (const rule of rules) {
    try {
      if (rule.detect()) return rule.platformId;
    } catch {
      // Detection failed, try next rule
    }
  }
  return "generic";
}
