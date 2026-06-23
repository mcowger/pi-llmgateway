# pi-llmgateway

Pi extension providing an LLM Gateway inference API provider.

## Purpose

Registers a `llmgateway` provider with Pi that connects to [LLM Gateway](https://api.llmgateway.io/v1), an OpenAI-compatible inference API that routes to 160+ models from OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek, and others.

## Stack

- TypeScript (strict mode), Bun, Biome, Changesets, Vitest

## Scripts

- `bun run typecheck` — Type check
- `bun run lint` — Lint
- `bun run format` — Format code
- `bun run test` — Run model validation tests (includes live API)
- `bun run gen:schema` — Regenerate schema.json
- `bun run changeset` — Create changeset for versioning

## Structure

```
src/
  config.ts                                  # Config schema, settings command, extension events
  lib/
    env.ts                                   # API key resolution (auth.json -> env var)
    llmgateway-api.ts                        # /v1/models fetch with timeout/abort
  extensions/
    provider/
      index.ts                               # Provider factory: registers provider + session lifecycle
      context-overflow.ts                    # Normalise context-overflow errors for Pi compaction
      routing.ts                             # streamSimple wrapper: injects routing/web_search into request body
      models/
        index.ts                             # Re-exports + buildModelsFromApi + getSeedModels helpers
        static.ts                            # Hardcoded model snapshot (zero-latency seed)
        map.ts                               # API model -> ProviderModelConfig converter
        family-defaults.ts                   # maxTokens defaults per model family
        overrides.ts                         # Per-model compat/thinking overrides
        cache.ts                             # Stale-while-revalidate disk cache for live model list
      models.test.ts                         # Vitest: snapshot drift vs live API + unit tests
  types/
    models-api.ts                            # /v1/models response types (OpenRouter-style schema)
```

## Provider configuration

- Provider name: `llmgateway`
- Base URL: `https://api.llmgateway.io/v1` (user-overridable for self-host)
- API: `openai-completions`
- Auth: auth.json entry for "llmgateway", fallback to `LLMGATEWAY_API_KEY` env var
- All models: `compat.supportsDeveloperRole: false`, `compat.maxTokensField: "max_tokens"`
- Reasoning models: `reasoning: true`, pass-through `thinkingLevelMap`, `thinkingFormat: "openai"` (default)

## Compat rationale

The LLM Gateway normalises upstream differences server-side (see `theopenco/llmgateway` -> `packages/actions/src/prepare-request-body.ts`):

- `max_tokens` → translated to `max_completion_tokens` for GPT-5/o-series by the gateway
- `developer` role → not supported; gateway uses `system` only
- `reasoning_effort` → gateway translates to each upstream's native format
- `reasoning_content` echoing → not required; gateway reconstructs for deepseek/moonshot
- Prompt caching → gateway manages cache_control markers per-upstream

## Routing / web_search injection

Pi's `ProviderConfig` has no extra-body hook. The gateway reads `routing` and `web_search` as JSON body fields. The `routing.ts` `streamSimple` wrapper intercepts `globalThis.fetch`, merges the configured fields into the `/chat/completions` request body, then restores fetch on stream end.

## Model loading (stale-while-revalidate)

1. Extension load (sync): read `${agentDir}/cache/llmgateway-models.json`; register provider with cached models. If cache is empty, fall back to the compiled-in `static.ts` snapshot. Zero latency — Pi's startup scoped-model validation sees models immediately.
2. `session_start`: fetch `/v1/models`, write result to cache, re-register provider with live list.

## Updating the model snapshot

1. Run `bun run test` to see drift between `static.ts` and the live API
2. Re-run the Python generator (see `src/extensions/provider/models/static.ts` header) or re-run the snapshot script when available
3. Commit the updated `static.ts`

## Settings

`/llmgateway:settings` allows configuring:
- **routing** — Provider routing strategy (`auto|price|throughput|latency`)
- **webSearch** — Enable native web search
- **baseUrl** — API base URL for self-hosted instances
- **includeDeactivated** — Show deactivated models
