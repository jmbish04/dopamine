import { getDb } from "@/db";
import { CODE_DRIVEN_CHECKS } from "./registry";
import { healthTestDefinitions, healthTestResults, healthScanJobs } from "@/db/schemas/health";
import { eq, desc } from "drizzle-orm";

export interface HealthCheckResult {
  id: string;
  name: string;
  group: string;
  ok: boolean;
  message: string;
  latencyMs: number;
}

export interface HealthRunSummary {
  jobId: string;
  trigger: "cron" | "on_demand";
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: HealthCheckResult[];
}

export async function runHealthSuite(
  env: Env,
  trigger: "cron" | "on_demand" = "on_demand"
): Promise<HealthRunSummary> {
  const db = getDb(env);
  const jobId = crypto.randomUUID();
  const runStart = Date.now();

  // Create job record (status: running)
  await db.insert(healthScanJobs).values({
    id: jobId,
    trigger,
    status: "running",
    passed: 0,
    failed: 0,
    total: 0,
    startedAt: new Date(),
  }).execute();

  const resultsToInsert: any[] = [];
  const runResults: HealthCheckResult[] = [];
  let passed = 0;
  let failed = 0;

  // 1. Run all code-driven checks
  for (const check of CODE_DRIVEN_CHECKS) {
    const start = Date.now();
    let res: { ok: boolean; message: string } = { ok: false, message: "Check threw an error." };
    try {
      res = await check.check(env);
    } catch (e: any) {
      res = { ok: false, message: e.message ?? String(e) };
    }
    const latencyMs = Date.now() - start;

    runResults.push({
      id: check.id,
      name: check.name,
      group: check.group,
      ok: res.ok,
      message: res.message,
      latencyMs,
    });

    if (res.ok) passed++; else failed++;

    resultsToInsert.push({
      id: crypto.randomUUID(),
      jobId,
      name: check.name,
      group: check.group,
      ok: res.ok,
      error: res.ok ? null : res.message,
      latencyMs,
      aiSuggestion: null,
      createdAt: new Date(),
    });
  }

  // 2. Run dynamic DB-defined tests
  const dynamicTests = await db.select().from(healthTestDefinitions)
    .where(eq(healthTestDefinitions.enabled, true));

  for (const test of dynamicTests) {
    const start = Date.now();
    let ok = false;
    let errorMsg: string | null = null;

    try {
      let fetchUrl = test.target;
      if (fetchUrl.startsWith("/")) fetchUrl = `https://dopamine.hacolby.workers.dev${fetchUrl}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(fetchUrl, { method: test.method, signal: controller.signal });
      clearTimeout(timeout);
      ok = res.status === test.expectedStatus;
      if (!ok) errorMsg = `Status ${res.status} (expected ${test.expectedStatus})`;
    } catch (e: any) {
      errorMsg = e.message;
    }

    const latencyMs = Math.min(Date.now() - start, 29999);

    runResults.push({
      id: test.id,
      name: test.name,
      group: "Dynamic Tests",
      ok,
      message: errorMsg ?? `${test.method} ${test.target} OK`,
      latencyMs,
    });

    if (ok) passed++; else failed++;

    resultsToInsert.push({
      id: crypto.randomUUID(),
      jobId,
      definitionId: test.id,
      name: test.name,
      group: "Dynamic Tests",
      ok,
      error: errorMsg,
      latencyMs,
      aiSuggestion: null,
      createdAt: new Date(),
    });
  }

  const durationMs = Date.now() - runStart;

  // 3. Persist all results
  if (resultsToInsert.length > 0) {
    for (const result of resultsToInsert) {
      await db.insert(healthTestResults).values(result).execute();
    }
  }

  // 4. Update job record to done
  await db.update(healthScanJobs).set({
    status: "done",
    passed,
    failed,
    total: resultsToInsert.length,
    durationMs,
    completedAt: new Date(),
  }).where(eq(healthScanJobs.id, jobId)).execute();

  return {
    jobId,
    trigger,
    total: resultsToInsert.length,
    passed,
    failed,
    durationMs,
    results: runResults,
  };
}

export async function getLatestHealthJob(env: Env) {
  const db = getDb(env);
  const job = await db.select().from(healthScanJobs)
    .where(eq(healthScanJobs.status, "done"))
    .orderBy(desc(healthScanJobs.startedAt))
    .limit(1)
    .get();
  if (!job) return null;

  const results = await db.select().from(healthTestResults)
    .where(eq(healthTestResults.jobId, job.id))
    .execute();

  return { job, results };
}
