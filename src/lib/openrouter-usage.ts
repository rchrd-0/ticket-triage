export type LlmRunUsage = {
  cost?: number;
};

type ProviderMetadataWithOpenRouterUsage = {
  openrouter?: {
    usage?: LlmRunUsage;
  };
};

export const getOpenRouterUsage = (providerMetadata: unknown): LlmRunUsage | undefined => {
  const openRouterMetadata = (providerMetadata as ProviderMetadataWithOpenRouterUsage | undefined)
    ?.openrouter;

  return openRouterMetadata?.usage;
};
