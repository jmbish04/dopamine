import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/durable-sqlite";

export const agentEvents = sqliteTable('agent_events', {
  id: text('id').primaryKey(),
  type: text('type'),
  action: text('action'),
  title: text('title'),
  description: text('description'),
  url: text('url'),
  actorLogin: text('actor_login'),
  actorAvatar: text('actor_avatar'),
  repoName: text('repo_name'),
  timestamp: text('timestamp').notNull(),
});

export const automationRuns = sqliteTable('automation_runs', {
  id: text('id').primaryKey(),
  ruleId: text('rule_id'),
  ruleName: text('rule_name'),
  workflow: text('workflow'),
  eventId: text('event_id'),
  status: text('status'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
});

export const agentSchema = { agentEvents, automationRuns };

export type AgentDb = any;

export function getAgentDb(storage: any): AgentDb {
  return drizzle(storage as any, { schema: agentSchema }) as any;
}
