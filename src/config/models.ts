type AgentModelConfig = {
  agentModel: string;
  temperature: number;
  reasoning: {
    effort: "xhigh" | "high" | "medium" | "low" | "minimal" | "none";
  };
  provider?: {
    order?: string[];
    only?: string[];
    allow_fallbacks?: boolean;
  };
};

export const classifier = {
  agentModel: "deepseek/deepseek-v4-flash",
  temperature: 0,
  reasoning: {
    effort: "none",
  },
} as const satisfies AgentModelConfig;

export const drafter = {
  agentModel: "google/gemini-2.5-flash-lite",
  temperature: 0.2,
  reasoning: {
    effort: "none",
  },
} as const satisfies AgentModelConfig;

export const investigator = {
  agentModel: "openai/gpt-5.4-mini",
  temperature: 0,
  reasoning: {
    effort: "low",
  },
} as const satisfies AgentModelConfig;
