import { Mastra } from "@mastra/core";
import { classifierAgent } from "./agents/weather.agent";

export const mastra = new Mastra({
  agents: { weatherAgent: classifierAgent },
});
