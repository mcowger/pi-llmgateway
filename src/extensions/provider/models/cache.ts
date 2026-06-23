import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

const CACHE_FILENAME = "llmgateway-models.json";

function getCachePath(): string {
  // Pi exposes getAgentDir() on the coding-agent package; fall back to a
  // temp path when running outside of Pi (e.g. in tests).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAgentDir } = require("@earendil-works/pi-coding-agent");
    return join(getAgentDir(), "cache", CACHE_FILENAME);
  } catch {
    return join(process.env.TMPDIR ?? "/tmp", CACHE_FILENAME);
  }
}

interface CacheFile {
  version: 1;
  fetchedAt: string;
  models: ProviderModelConfig[];
}

/** Read the on-disk model cache. Returns an empty array on any read/parse error. */
export function loadCachedModels(): ProviderModelConfig[] {
  try {
    const raw = readFileSync(getCachePath(), "utf-8");
    const parsed: CacheFile = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.models)) return [];
    return parsed.models;
  } catch {
    return [];
  }
}

/** Write the model list to the on-disk cache. Silently ignores write errors. */
export function writeCachedModels(models: ProviderModelConfig[]): void {
  try {
    const path = getCachePath();
    mkdirSync(dirname(path), { recursive: true });
    const data: CacheFile = {
      version: 1,
      fetchedAt: new Date().toISOString(),
      models,
    };
    writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Non-fatal: a stale or missing cache just means we use the static snapshot.
  }
}
