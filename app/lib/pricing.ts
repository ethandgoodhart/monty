import type { PromptEvent } from "./prompt-events";

type ModelPricing = { input: number; cacheWrite: number; cacheRead: number; output: number };

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-6": { input: 15, cacheWrite: 18.75, cacheRead: 1.50, output: 75 },
  "claude-opus-4-5-20250514": { input: 15, cacheWrite: 18.75, cacheRead: 1.50, output: 75 },
  "claude-sonnet-4-5-20250514": { input: 3, cacheWrite: 3.75, cacheRead: 0.30, output: 15 },
  "claude-sonnet-4-20250514": { input: 3, cacheWrite: 3.75, cacheRead: 0.30, output: 15 },
  "claude-haiku-3-5-20241022": { input: 0.80, cacheWrite: 1.00, cacheRead: 0.08, output: 4 },
  "gpt-5.5": { input: 2, cacheWrite: 2, cacheRead: 0.50, output: 10 },
  "gpt-5.4": { input: 1.5, cacheWrite: 1.5, cacheRead: 0.375, output: 6 },
  "gpt-5.4-mini": { input: 0.4, cacheWrite: 0.4, cacheRead: 0.1, output: 1.6 },
  "gpt-5.2-codex": { input: 0.75, cacheWrite: 0.75, cacheRead: 0.1875, output: 3 },
  "gpt-5.1-codex-mini": { input: 0.3, cacheWrite: 0.3, cacheRead: 0.075, output: 1.25 },
  "gpt-4o": { input: 2.5, cacheWrite: 2.5, cacheRead: 1.25, output: 10 },
  "gpt-4.1": { input: 2, cacheWrite: 2, cacheRead: 0.5, output: 8 },
  "o4-mini": { input: 1.10, cacheWrite: 1.10, cacheRead: 0.275, output: 4.40 },
  "o3-mini": { input: 1.10, cacheWrite: 1.10, cacheRead: 0.275, output: 4.40 },
};

export function getModelPricing(model: string): ModelPricing {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.includes(key) || key.includes(model)) return pricing;
  }
  if (model.includes("claude-opus")) return MODEL_PRICING["claude-opus-4-6"];
  if (model.includes("claude-sonnet")) return MODEL_PRICING["claude-sonnet-4-5-20250514"];
  if (model.includes("claude-haiku")) return MODEL_PRICING["claude-haiku-3-5-20241022"];
  if (model.includes("gpt")) return { input: 2, cacheWrite: 2, cacheRead: 0.5, output: 8 };
  return { input: 3, cacheWrite: 3, cacheRead: 0.75, output: 12 };
}

export function computeCost(model: string, inputTokens: number, outputTokens: number, cacheCreationTokens: number, cacheReadTokens: number): number {
  const pricing = getModelPricing(model);
  const uncachedInput = Math.max(0, inputTokens - cacheCreationTokens - cacheReadTokens);
  return (
    (uncachedInput / 1_000_000) * pricing.input +
    (cacheCreationTokens / 1_000_000) * pricing.cacheWrite +
    (cacheReadTokens / 1_000_000) * pricing.cacheRead +
    (outputTokens / 1_000_000) * pricing.output
  );
}

export function computeEventCost(e: PromptEvent): number {
  const model = e.model || e.source || "unknown";
  const input = e.input_tokens || (e.metadata?.input_tokens as number) || 0;
  const output = e.output_tokens || (e.metadata?.output_tokens as number) || 0;
  const cacheCreation = (e.metadata?.cache_creation_input_tokens as number) || 0;
  const cacheRead = (e.metadata?.cache_read_input_tokens as number) || 0;
  return computeCost(model, input, output, cacheCreation, cacheRead);
}

export function formatCost(cost: number): string {
  if (cost >= 1000) return "$" + (cost / 1000).toFixed(1) + "K";
  if (cost >= 1) return "$" + cost.toFixed(2);
  if (cost >= 0.01) return "$" + cost.toFixed(2);
  return "$" + cost.toFixed(2);
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}
