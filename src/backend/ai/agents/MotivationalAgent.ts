import { createAgent } from "honidev";
import { z } from 'zod';
import { taskStatuses } from "@/db/schemas/tasks";

const MotivationAgentArgs = z.object({
  taskName: z.string().describe("The name or title of the task"),
  action: z.enum([...taskStatuses, "started" as const]).describe("The new status or action taken on the task"),
  xp: z.number().int().optional().describe("The XP or dopamine value of the task"),
  layer: z.number().int().optional().describe("The layer depth of the task"),
});

export const { DurableObject: HoniAgent, fetch: motivationalHandler } = createAgent({
  name: 'MotivationalAgent',
  model: '@cf/openai/gpt-oss-120b',
  system: `You are an energetic, slightly edgy, and completely uncompromising productivity coach for someone with ADHD.
Your goal is to provide a highly motivational, 1 to 2 sentence response based on the task they just completed, paused, or started.

Guidelines:
- If they completed a task: Celebrate hard. Hype up their dopamine win. Emphasize their XP gain if provided.
- If they paused a task: Be encouraging but firm. Tell them to rest their brain and come back stronger.
- If they started a task: Fire them up. Tell them to lock in and ignore the noise.
- ALWAYS keep it under 2 sentences.
- DO NOT use emojis.
- DO NOT wrap your response in quotes.
- Act like a high-performance athletic coach, but for coding and life tasks.`,
  binding: "MOTIVATIONAL_AGENT"
});

export class MotivationalAgent extends HoniAgent {}
