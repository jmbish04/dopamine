import { sql } from "drizzle-orm";

import { getDb } from "@/db";

export type HealthCheck = {
  module: string;
  dependency: string;
  ok: boolean;
  message: string;
};

export const checkTasksHealth = async (env: Env): Promise<HealthCheck[]> => {
  const checks: HealthCheck[] = [];

  try {
    await getDb(env).run(sql`select 1 as ok`);
    checks.push({
      module: "tasks",
      dependency: "DB",
      ok: true,
      message: "D1 query succeeded.",
    });
  } catch (error) {
    checks.push({
      module: "tasks",
      dependency: "DB",
      ok: false,
      message: error instanceof Error ? error.message : "Unknown database error.",
    });
  }

  checks.push({
    module: "tasks",
    dependency: "PRINTER_VPC",
    ok: Boolean(env.PRINTER_VPC),
    message: env.PRINTER_VPC
      ? "Printer VPC binding is present."
      : "Printer VPC binding is missing.",
  });

  return checks;
};
