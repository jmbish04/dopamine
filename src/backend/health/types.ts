export interface HealthStepResult {
  name: string;
  status: "success" | "failure" | "skipped";
  message: string;
  durationMs: number;
  details?: Record<string, any>;
}
