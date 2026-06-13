"""
Claude API token usage tracking and cost estimation.

Pricing source: Anthropic pricing page (as of June 2026)
  claude-sonnet-4-6:
    Input tokens:       $3.00  / 1M tokens
    Output tokens:      $15.00 / 1M tokens
    Cache write:        $3.75  / 1M tokens  (5-minute TTL)
    Cache read:         $0.30  / 1M tokens

The system prompt is a strong cache candidate — it's large (~600 tokens)
and identical across every valuation request. With prompt caching enabled,
subsequent calls pay the cache read rate instead of full input rate.

Cache break-even: a cache write costs 1.25x input rate, so caching is
profitable after the first reuse within the 5-minute TTL window.
"""

from dataclasses import dataclass, field, asdict


# Anthropic pricing — update if rates change
# Source: https://www.anthropic.com/pricing (June 2026)
PRICING = {
    "claude-sonnet-4-6": {
        "input_per_m":         3.00,
        "output_per_m":       15.00,
        "cache_write_per_m":   3.75,
        "cache_read_per_m":    0.30,
    }
}


@dataclass
class TokenUsage:
    model: str = "claude-sonnet-4-6"
    input_tokens: int = 0
    output_tokens: int = 0
    cache_write_tokens: int = 0
    cache_read_tokens: int = 0

    # Accumulated across all API calls in one agent run
    api_calls: int = 0

    def add(self, usage) -> None:
        """Accumulate usage from a single Anthropic API response."""
        self.api_calls += 1
        self.input_tokens       += getattr(usage, "input_tokens", 0)
        self.output_tokens      += getattr(usage, "output_tokens", 0)
        self.cache_write_tokens += getattr(usage, "cache_creation_input_tokens", 0)
        self.cache_read_tokens  += getattr(usage, "cache_read_input_tokens", 0)

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    def cost_usd(self) -> float:
        p = PRICING[self.model]
        return (
            (self.input_tokens       / 1_000_000) * p["input_per_m"]
            + (self.output_tokens    / 1_000_000) * p["output_per_m"]
            + (self.cache_write_tokens / 1_000_000) * p["cache_write_per_m"]
            + (self.cache_read_tokens  / 1_000_000) * p["cache_read_per_m"]
        )

    def cost_without_caching_usd(self) -> float:
        """What this run would have cost with no prompt caching."""
        p = PRICING[self.model]
        hypothetical_input = self.input_tokens + self.cache_read_tokens
        return (
            (hypothetical_input   / 1_000_000) * p["input_per_m"]
            + (self.output_tokens / 1_000_000) * p["output_per_m"]
        )

    def cache_savings_usd(self) -> float:
        return self.cost_without_caching_usd() - self.cost_usd()

    def to_display(self) -> dict:
        cost = self.cost_usd()
        savings = self.cache_savings_usd()
        return {
            "model":               self.model,
            "api_calls":           self.api_calls,
            "input_tokens":        self.input_tokens,
            "output_tokens":       self.output_tokens,
            "cache_write_tokens":  self.cache_write_tokens,
            "cache_read_tokens":   self.cache_read_tokens,
            "total_tokens":        self.total_tokens,
            "cost_usd":            round(cost, 6),
            "cost_display":        f"${cost:.4f}",
            "cache_savings_usd":   round(savings, 6),
            "cache_savings_display": f"${savings:.4f}" if savings > 0 else "$0.00",
            "cache_hit":           self.cache_read_tokens > 0,
        }
