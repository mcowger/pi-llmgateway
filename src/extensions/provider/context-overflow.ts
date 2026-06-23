interface AssistantErrorLike {
  role: string;
  stopReason?: string;
  provider?: string;
  errorMessage?: string;
}

/**
 * The LLM Gateway surfaces context-length errors from multiple upstream
 * providers in varying formats. This regex matches the most common ones.
 */
const CONTEXT_OVERFLOW_PATTERNS = [
  /context.{0,20}length.{0,20}exceed/i,
  /maximum.{0,20}context/i,
  /too.{0,10}long.{0,20}context/i,
  /input.{0,20}too.{0,10}long/i,
  /tokens.{0,20}exceed.{0,20}(limit|maximum)/i,
  /prompt.{0,20}too.{0,10}long/i,
];

/**
 * Normalise LLM Gateway context-overflow errors so Pi's native compaction
 * path can detect and perform compact-and-retry.
 *
 * Pi recognises an error as a context overflow when errorMessage contains
 * "context_length_exceeded". The gateway surfaces different strings depending
 * on the upstream provider (OpenAI, Anthropic, Google, etc.), so we match
 * the common patterns and prefix with the canonical marker.
 */
export function normalizeContextOverflowError<
  TMessage extends AssistantErrorLike,
>(message: TMessage, currentProvider?: string): TMessage | undefined {
  if (message.role !== "assistant") return undefined;
  if (message.stopReason !== "error") return undefined;
  if (message.provider !== "llmgateway" && currentProvider !== "llmgateway") {
    return undefined;
  }

  const err = message.errorMessage ?? "";

  // Already in canonical form — nothing to do.
  if (err.includes("context_length_exceeded")) return undefined;

  const matched = CONTEXT_OVERFLOW_PATTERNS.some((re) => re.test(err));
  if (!matched) return undefined;

  return {
    ...message,
    errorMessage: `context_length_exceeded: ${err}`,
  };
}
