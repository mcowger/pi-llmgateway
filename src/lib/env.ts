import type { AuthStorage } from "@earendil-works/pi-coding-agent";

const PROVIDER_ID = "llmgateway";

/**
 * Resolve the LLM Gateway API key through Pi's auth handling.
 *
 * Resolution order:
 * 1. Runtime override (CLI --api-key)
 * 2. auth.json entry for "llmgateway"
 * 3. Environment variable LLMGATEWAY_API_KEY
 */
export async function getLLMGatewayApiKey(
  authStorage: AuthStorage,
): Promise<string | undefined> {
  const key = await authStorage.getApiKey(PROVIDER_ID);
  return key ?? process.env.LLMGATEWAY_API_KEY;
}
