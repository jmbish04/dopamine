// Agent registry for the dopamine project
import { posterAgent } from "./poster";

const agents = {
  poster: posterAgent,
};

export function getAgentByName(name: string) {
  return agents[name as keyof typeof agents];
}

export * from "./poster";
