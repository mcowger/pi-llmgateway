/**
 * streamSimple wrapper that injects LLM Gateway-specific request body fields
 * (routing strategy, web_search) into outgoing /chat/completions requests.
 *
 * Pi's ProviderConfig only exposes `headers` for request customisation — there
 * is no extra-body hook. The gateway reads `routing` and `web_search` as JSON
 * body fields, not headers, so we intercept globalThis.fetch and merge these
 * fields into the serialised body before it reaches the gateway.
 *
 * The intercept is scoped to requests whose URL ends with /chat/completions on
 * the configured provider origin, and is always restored when the stream ends.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type {
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";

export type AnyStreamSimple = (
  model: Model<string>,
  context: Context,
  options?: SimpleStreamOptions,
) => AssistantMessageEventStream;

export interface RoutingOptions {
  /** LLM Gateway routing strategy. "auto" uses the full weighted smart-routing score. */
  routing?: "auto" | "price" | "throughput" | "latency";
  /** Enable native web search for models that support it. */
  webSearch?: boolean;
}

export const routingContextStore = new AsyncLocalStorage<{
  extra: Record<string, unknown>;
  origin: string;
}>();

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const store = routingContextStore.getStore();
  if (store && isGatewayChatUrl(input, store.origin)) {
    const patchedInit = await patchRequestBody(init, store.extra);
    return originalFetch(input, patchedInit);
  }
  return originalFetch(input, init);
};

function isGatewayChatUrl(input: RequestInfo | URL, origin: string): boolean {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
  try {
    const url = new URL(raw, "http://localhost");
    return url.origin === origin && url.pathname.endsWith("/chat/completions");
  } catch {
    return false;
  }
}

async function patchRequestBody(
  init: RequestInit | undefined,
  extra: Record<string, unknown>,
): Promise<RequestInit> {
  const baseInit = init ?? {};
  let body = baseInit.body;

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      body = JSON.stringify({ ...parsed, ...extra });
    } catch {
      // If we can't parse the body, leave it untouched.
    }
  }

  return { ...baseInit, body };
}

/**
 * Wrap a base streamSimple function to inject `routing` and `web_search`
 * into every outgoing /chat/completions request body.
 *
 * When both options are unset (or routing is "auto" and webSearch is false),
 * no patching occurs and the base function is called without overhead.
 */
export function wrapWithRouting(
  base: AnyStreamSimple,
  options: RoutingOptions,
): AnyStreamSimple {
  const { routing, webSearch } = options;

  // Build the extra fields to inject. Skip fields that add no information.
  const extra: Record<string, unknown> = {};
  if (routing && routing !== "auto") extra.routing = routing;
  if (webSearch) extra.web_search = true;

  // Nothing to inject — return the base function unwrapped.
  if (Object.keys(extra).length === 0) return base;

  return (model, context, opts = {}) => {
    const providerOrigin = new URL(
      model.baseUrl ?? "https://api.llmgateway.io/v1",
    ).origin;

    return routingContextStore.run({ extra, origin: providerOrigin }, () => {
      return base(model, context, opts);
    });
  };
}
