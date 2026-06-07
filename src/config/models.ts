export const classifier = {
  agentModel: "google/gemini-2.5-flash-lite",
  temperature: 0,
  reasoning: {
    effort: "none",
  },
} as const;

export const drafter = {
  agentModel: "google/gemini-2.5-flash-lite",
  temperature: 0.2,
  reasoning: {
    effort: "none",
  },
} as const;
