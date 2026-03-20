import { DB_CHECKS } from "./checks/db";
import { AI_CHECKS } from "./checks/ai";
import { PRINTER_CHECKS } from "./checks/printer";
import { AGENT_CHECKS } from "./checks/agents";
import { SPOTIFY_CHECKS } from "./checks/spotify";
import { API_CHECKS } from "./checks/api";

export interface CodeHealthCheck {
  id: string;
  name: string;
  group: string;
  check: (env: Env) => Promise<{ ok: boolean; message: string }>;
}

export const CODE_DRIVEN_CHECKS: CodeHealthCheck[] = [
  ...DB_CHECKS,
  ...AI_CHECKS,
  ...PRINTER_CHECKS,
  ...AGENT_CHECKS,
  ...SPOTIFY_CHECKS,
  ...API_CHECKS,
];

