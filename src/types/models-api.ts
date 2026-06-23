/** Architecture description from the LLM Gateway /v1/models response. */
export interface LLMGatewayModelArchitecture {
  input_modalities: string[];
  output_modalities: string[];
  tokenizer: string;
}

/** Top-level provider info attached to a model. */
export interface LLMGatewayModelTopProvider {
  is_moderated: boolean;
}

/** Pricing for a single provider mapping. Values are per-token decimal strings (e.g. "1.5e-6"). */
export interface LLMGatewayProviderPricing {
  prompt?: string;
  completion?: string;
  image?: string;
  per_second?: Record<string, string>;
}

/** A single upstream provider mapping for a model. */
export interface LLMGatewayModelProvider {
  providerId: string;
  externalId: string;
  pricing?: LLMGatewayProviderPricing;
  streaming?: boolean;
  vision?: boolean;
  cancellation?: boolean;
  tools?: boolean;
  parallelToolCalls?: boolean;
  reasoning?: boolean;
  stability?: "stable" | "beta" | "unstable" | null;
  supportedVideoSizes?: string[];
  supportsVideoAudio?: boolean;
  supportsVideoWithoutAudio?: boolean;
}

/**
 * Pricing object at the model level.
 * Values are per-token decimal strings (e.g. "1.5e-6"). Multiply by 1_000_000 to get per-million cost.
 */
export interface LLMGatewayModelPricing {
  prompt?: string;
  completion?: string;
  image?: string;
  request?: string;
  input_cache_read?: string;
  input_cache_write?: string;
  input_cache_write_1h?: string;
  web_search?: string;
  internal_reasoning?: string;
}

/** A model entry from the LLM Gateway /v1/models response. */
export interface LLMGatewayApiModel {
  id: string;
  name: string;
  aliases?: string[];
  created: number;
  description?: string;
  family?: string;
  architecture: LLMGatewayModelArchitecture;
  top_provider: LLMGatewayModelTopProvider;
  providers: LLMGatewayModelProvider[];
  pricing: LLMGatewayModelPricing;
  context_length: number;
  per_request_limits?: Record<string, string>;
  supported_parameters?: string[];
  json_output?: boolean;
  structured_outputs?: boolean;
  free?: boolean;
  deprecated_at?: string;
  deactivated_at?: string;
  stability?: "stable" | "beta" | "unstable" | null;
}

/** The /v1/models response envelope. */
export interface LLMGatewayModelsResponse {
  data: LLMGatewayApiModel[];
}
