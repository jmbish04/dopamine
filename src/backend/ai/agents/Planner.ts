import { createAgent, z } from "honidev";

const PlanSchema = z.object({
  title: z.string().describe("The comprehensive title of the plan"),
  steps: z.array(
    z.object({
      id: z.string().describe("Unique identifier for the step (e.g., step-1)"),
      description: z.string().describe("Detailed description of what needs to be done"),
      difficulty: z.enum(["easy", "medium", "hard"]).describe("Estimated difficulty level"),
      command: z.string().optional().describe("CLI command provided if applicable"),
    }),
  ),
});

export const { DurableObject: Agent, fetch: plannerHandler } = createAgent({
  name: "PlannerAgent",
  model: "@cf/meta/llama-3.1-8b-instruct", // Standard DO LLM fallback, user configurable later
  system: "Create an implementation plan for the user goal. Return a concise, execution-ready plan conforming to the requested schema.",
  binding: "PLANNER",
  memory: {
    enabled: true,
    episodic: {
      enabled: true,
      binding: "DB",
      limit: 50,
    },
    semantic: {
      enabled: true,
      binding: "VECTORIZE_LOGS",
      aiBinding: "AI",
      topK: 5,
    },
  },
  // Note: structured output for honidev can be handled either via tools or if honidev exposes an outputType override natively.
  // For now, if we don't have a rigid output type native to honidev, we instruct in the system prompt.
});

export class PlannerAgent extends Agent {}
export default plannerHandler;
