import { streamSimpleOpenAICompletions } from "@earendil-works/pi-ai/openai-completions";
import type {
  ExtensionAPI,
  ProviderModelConfig,
} from "@earendil-works/pi-coding-agent";
import {
  configLoader,
  emitConfigUpdated,
  LLMGATEWAY_CONFIG_UPDATED_EVENT,
  registerLLMGatewaySettings,
} from "../../config";
import { getLLMGatewayApiKey } from "../../lib/env";
import { fetchModels } from "../../lib/llmgateway-api";
import { normalizeContextOverflowError } from "./context-overflow";
import {
  buildModelsFromApi,
  getSeedModels,
  LLMGATEWAY_STATIC_MODELS,
  loadCachedModels,
  writeCachedModels,
} from "./models";
import { type AnyStreamSimple, wrapWithRouting } from "./routing";

function registerProvider(
  pi: ExtensionAPI,
  models: ProviderModelConfig[],
): void {
  const { baseUrl, routing, webSearch } = configLoader.getConfig();

  const baseStreamSimple = streamSimpleOpenAICompletions as AnyStreamSimple;

  const config: Parameters<ExtensionAPI["registerProvider"]>[1] = {
    baseUrl,
    apiKey: "$LLMGATEWAY_API_KEY",
    api: "openai-completions",
    authHeader: true,
    headers: {
      "HTTP-Referer": "https://github.com/mcowger/pi-llmgateway",
      "X-Title": "npm:@mcowger/pi-llmgateway",
    },
    models,
  };

  if (baseStreamSimple) {
    config.streamSimple = wrapWithRouting(baseStreamSimple, {
      routing,
      webSearch,
    }) as never;
  }

  pi.registerProvider("llmgateway", config);
}

export default async function (pi: ExtensionAPI) {
  await configLoader.load();

  // Stale-while-revalidate seed: read the on-disk model cache so that models
  // from a previous session_start are available at load time (before the live
  // fetch). This prevents "No models match pattern" warnings on saved scoped
  // models when Pi validates them during startup — before session_start fires.
  let liveModels: ProviderModelConfig[] = loadCachedModels();
  const seedModels = getSeedModels(liveModels, LLMGATEWAY_STATIC_MODELS);

  let modelsLoaded = false;
  let fetchAbort: AbortController | undefined;

  registerProvider(pi, seedModels);
  registerLLMGatewaySettings(pi);

  // Re-register when settings change (e.g. baseUrl, routing, webSearch).
  pi.events.on(LLMGATEWAY_CONFIG_UPDATED_EVENT, () => {
    registerProvider(pi, liveModels.length > 0 ? liveModels : seedModels);
  });

  pi.on("session_shutdown", () => {
    fetchAbort?.abort();
    fetchAbort = undefined;
  });

  pi.on("message_end", (event, ctx) => {
    const overflowMessage = normalizeContextOverflowError(
      event.message,
      ctx.model?.provider,
    );
    if (!overflowMessage) return;
    return { message: overflowMessage };
  });

  pi.on("session_start", async (_event, ctx) => {
    const { baseUrl, includeDeactivated } = configLoader.getConfig();

    // Drain any config messages accumulated before the session.
    for (const message of configLoader.drainMessages()) {
      ctx.ui.notify(message, "warning");
    }

    emitConfigUpdated(pi);

    if (!modelsLoaded) {
      modelsLoaded = true;
      fetchAbort?.abort();
      fetchAbort = new AbortController();

      const apiKey = await getLLMGatewayApiKey(ctx.modelRegistry.authStorage);
      const result = await fetchModels({
        baseUrl,
        apiKey,
        signal: fetchAbort.signal,
      });

      if (result.success && !fetchAbort.signal.aborted) {
        const fetched = buildModelsFromApi(result.data, includeDeactivated);
        liveModels = fetched;
        await writeCachedModels(fetched);
        registerProvider(pi, fetched);
      }
    }
  });
}
