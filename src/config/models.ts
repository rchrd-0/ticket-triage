export const classifier = {
  agentModel: "google/gemini-2.5-flash-lite",
  temperature: 0,
  reasoning: {
    effort: "none",
  },
} as const;

export const drafter = {
  agentModel: "openai/gpt-5-mini",
  temperature: 0.3,
  reasoning: {
    effort: "none",
  },
} as const;
