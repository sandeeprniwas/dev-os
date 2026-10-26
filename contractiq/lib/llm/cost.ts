export type TokenUsage = {
  prompt_tokens: number
  completion_tokens: number
  prompt_tokens_details?: { cached_tokens?: number | null } | null
}

/** USD per 1M tokens. Verify against https://openai.com/api/pricing before launch. */
export const PRICING: Record<string, { input: number; cachedInput: number; output: number }> = {
  'gpt-4o': { input: 2.5, cachedInput: 1.25, output: 10 },
}

const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000

export function computeCost(model: string, usage: TokenUsage): number {
  const price = PRICING[model] ?? PRICING['gpt-4o']
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0
  const uncached = Math.max(0, usage.prompt_tokens - cached)
  return round6((uncached * price.input + cached * price.cachedInput + usage.completion_tokens * price.output) / 1_000_000)
}

export function addUsage(a: TokenUsage | null, b: TokenUsage | null): TokenUsage | null {
  if (!a) return b
  if (!b) return a
  return {
    prompt_tokens: a.prompt_tokens + b.prompt_tokens,
    completion_tokens: a.completion_tokens + b.completion_tokens,
    prompt_tokens_details: {
      cached_tokens: (a.prompt_tokens_details?.cached_tokens ?? 0) + (b.prompt_tokens_details?.cached_tokens ?? 0),
    },
  }
}
