import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const systemState = sqliteTable("system_state", {
  id: text("id").primaryKey(), // We will use 'global_session'
  activeTaskId: text("active_task_id"),
});
