import { suggestHealthRemediation } from "@backend/ai-provider";
import { checkTasksHealth, type HealthCheck } from "@/health";

export type HealthPayload = {
  status: "ok" | "degraded";
  generatedAt: string;
  checks: HealthCheck[];
  remediation: {
    module: string;
    dependency: string;
    suggestion: string;
  }[];
};

export const getHealthPayload = async (env: Env): Promise<HealthPayload> => {
  const checks = await checkTasksHealth(env);
  const failures = checks
    .filter((check) => !check.ok)
    .map((check) => ({
      module: check.module,
      dependency: check.dependency,
      message: check.message,
    }));

  return {
    status: failures.length ? "degraded" : "ok",
    generatedAt: new Date().toISOString(),
    checks,
    remediation: failures.length ? suggestHealthRemediation(failures) : [],
  };
};
