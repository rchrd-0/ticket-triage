type AgentModelConfig = {
  agentModel: string;
  temperature: number;
  reasoning: {
    effort: "xhigh" | "high" | "medium" | "low" | "minimal" | "none";
  };
};

export const classifier = {
  agentModel: "xiaomi/mimo-v2-flash",
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
