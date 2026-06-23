import {
  ConfigLoader,
  registerSettingsCommand,
  type SettingsSection,
} from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const LLMGATEWAY_CONFIG_UPDATED_EVENT =
  "llmgateway:config:updated" as const;

export interface LLMGatewayConfigUpdatedPayload {
  config: ResolvedLLMGatewayConfig;
}

/** User-facing config schema (sparse — only set keys are persisted). */
export interface LLMGatewayConfig {
  /**
   * Override the base URL for self-hosted LLM Gateway instances.
   * Defaults to "https://api.llmgateway.io/v1".
   */
  baseUrl?: string;

  /**
   * Provider routing strategy. Controls which upstream provider the gateway
   * selects for auto-routed model IDs.
   *
   * - "auto"       Full weighted smart-routing score (default).
   * - "price"      Optimise for lowest cost.
   * - "throughput" Optimise for highest throughput.
   * - "latency"    Optimise for lowest latency (streaming requests only).
   *
   * Note: on coding (dev) plans only "auto" and "price" are available.
   */
  routing?: "auto" | "price" | "throughput" | "latency";

  /**
   * Enable native web search for models that support it. When true, the
   * gateway instructs the model to search the web for real-time information.
   */
  webSearch?: boolean;

  /**
   * When true, include models marked as deactivated in the model list.
   * Deactivated models may be removed from the gateway at any time.
   * Defaults to false.
   */
  includeDeactivated?: boolean;
}

/** Resolved config with all defaults applied. */
export interface ResolvedLLMGatewayConfig {
  baseUrl: string;
  routing: "auto" | "price" | "throughput" | "latency";
  webSearch: boolean;
  includeDeactivated: boolean;
}

const DEFAULTS: ResolvedLLMGatewayConfig = {
  baseUrl: "https://api.llmgateway.io/v1",
  routing: "auto",
  webSearch: false,
  includeDeactivated: false,
};

export const configLoader = new ConfigLoader<
  LLMGatewayConfig,
  ResolvedLLMGatewayConfig
>("llmgateway", DEFAULTS);

export function emitConfigUpdated(pi: ExtensionAPI): void {
  pi.events.emit(LLMGATEWAY_CONFIG_UPDATED_EVENT, {
    config: configLoader.getConfig(),
  });
}

export function registerLLMGatewaySettings(pi: ExtensionAPI): void {
  registerSettingsCommand<LLMGatewayConfig, ResolvedLLMGatewayConfig>(pi, {
    commandName: "llmgateway:settings",
    title: "LLM Gateway Settings",
    configStore: configLoader,
    buildSections: (tabConfig, resolved): SettingsSection[] => {
      const cfg = (k: keyof LLMGatewayConfig) =>
        tabConfig?.[k] ?? resolved[k as keyof ResolvedLLMGatewayConfig];

      return [
        {
          label: "Routing",
          items: [
            {
              id: "routing",
              label: "Routing strategy",
              description:
                "Provider selection strategy. 'auto' uses the full weighted smart-routing score. 'price', 'throughput', 'latency' weight that factor 90%. Note: coding (dev) plans only support 'auto' and 'price'.",
              currentValue: String(cfg("routing")),
              values: ["auto", "price", "throughput", "latency"],
            },
            {
              id: "webSearch",
              label: "Web search",
              description:
                "Enable native web search for models that support it. The model can search the web for real-time information.",
              currentValue: cfg("webSearch") ? "enabled" : "disabled",
              values: ["enabled", "disabled"],
            },
          ],
        },
        {
          label: "Connection",
          items: [
            {
              id: "baseUrl",
              label: "Base URL",
              description:
                "API base URL. Change this for self-hosted LLM Gateway instances. Restart Pi after changing.",
              currentValue: String(cfg("baseUrl")),
              values: [],
            },
          ],
        },
        {
          label: "Models",
          items: [
            {
              id: "includeDeactivated",
              label: "Include deactivated models",
              description:
                "Show models that the gateway has flagged as deactivated. These may stop working at any time.",
              currentValue: cfg("includeDeactivated") ? "include" : "ignore",
              values: ["include", "ignore"],
            },
          ],
        },
      ];
    },
    onSettingChange: (id, newValue, config) => {
      switch (id) {
        case "routing":
          return {
            ...config,
            routing: newValue as ResolvedLLMGatewayConfig["routing"],
          };
        case "webSearch":
          return { ...config, webSearch: newValue === "enabled" };
        case "baseUrl":
          return { ...config, baseUrl: newValue };
        case "includeDeactivated":
          return { ...config, includeDeactivated: newValue === "include" };
        default:
          return null;
      }
    },
    onSave: async () => {
      emitConfigUpdated(pi);
    },
  });
}
