import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { runHealthSuite, getLatestHealthJob } from "@/health/service";
import { getDb } from "@/db";
import { healthTestDefinitions, healthTestResults, healthScanJobs } from "@/db/schemas/health";
import { desc, eq } from "drizzle-orm";
import { getHealthPayload } from "@/api";

export const healthRoutes = new OpenAPIHono<{ Bindings: Env }>();

// ─── Schema ──────────────────────────────────────────────────────────────────

const healthRunResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.string(),
  ok: z.boolean(),
  message: z.string(),
  latencyMs: z.number(),
});

const healthRunSummarySchema = z.object({
  jobId: z.string(),
  trigger: z.enum(["cron", "on_demand"]),
  total: z.number(),
  passed: z.number(),
  failed: z.number(),
  durationMs: z.number(),
  results: z.array(healthRunResultSchema),
});

const healthJobSchema = z.object({
  id: z.string(),
  trigger: z.string(),
  status: z.string(),
  passed: z.number(),
  failed: z.number(),
  total: z.number(),
  durationMs: z.number().nullable(),
  startedAt: z.any(),
  completedAt: z.any().nullable(),
});

const HealthTestDefinitionSchema = z.object({
  name: z.string(),
  target: z.string(),
  method: z.string(),
  expectedStatus: z.number(),
  frequencySeconds: z.number(),
  criticality: z.string(),
  enabled: z.boolean(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/health — backwards-compatible legacy payload
healthRoutes.openapi(createRoute({
  method: "get", path: "/", operationId: "getHealth",
  responses: { 200: { description: "Worker health status.", content: { "application/json": { schema: z.any() } } } },
}), async (c) => c.json(await getHealthPayload(c.env), 200));

// POST /api/health/run — trigger on-demand run
healthRoutes.openapi(createRoute({
  method: "post", path: "/run", operationId: "runHealthSuite",
  responses: { 200: { description: "Full run summary.", content: { "application/json": { schema: healthRunSummarySchema } } } },
}), async (c) => {
  const summary = await runHealthSuite(c.env, "on_demand");
  return c.json(summary, 200);
});

// GET /api/health/latest — latest completed job + its results
healthRoutes.openapi(createRoute({
  method: "get", path: "/latest", operationId: "getLatestHealthRun",
  responses: { 200: { description: "Latest health scan results.", content: { "application/json": { schema: z.any() } } } },
}), async (c) => {
  const data = await getLatestHealthJob(c.env);
  return c.json(data ?? { job: null, results: [] }, 200);
});

// GET /api/health/jobs — paginated job history
healthRoutes.openapi(createRoute({
  method: "get", path: "/jobs", operationId: "listHealthJobs",
  request: { query: z.object({ limit: z.string().optional() }) },
  responses: { 200: { description: "Job history.", content: { "application/json": { schema: z.array(healthJobSchema) } } } },
}), async (c) => {
  const db = getDb(c.env);
  const { limit } = c.req.valid("query");
  const jobs = await db.select().from(healthScanJobs)
    .orderBy(desc(healthScanJobs.startedAt))
    .limit(Number(limit ?? 20))
    .execute();
  return c.json(jobs, 200);
});

// GET /api/health/jobs/:jobId — all results for a specific job
healthRoutes.openapi(createRoute({
  method: "get", path: "/jobs/:jobId", operationId: "getHealthJob",
  request: { params: z.object({ jobId: z.string() }) },
  responses: { 200: { description: "Job results.", content: { "application/json": { schema: z.any() } } } },
}), async (c) => {
  const { jobId } = c.req.valid("param");
  const db = getDb(c.env);
  const [job, results] = await Promise.all([
    db.select().from(healthScanJobs).where(eq(healthScanJobs.id, jobId)).get(),
    db.select().from(healthTestResults).where(eq(healthTestResults.jobId, jobId)).execute(),
  ]);
  return c.json({ job: job ?? null, results }, 200);
});

// GET /api/health/history — raw result rows (legacy)
healthRoutes.openapi(createRoute({
  method: "get", path: "/history", operationId: "getHealthHistory",
  responses: { 200: { description: "Recent results.", content: { "application/json": { schema: z.array(z.any()) } } } },
}), async (c) => {
  const db = getDb(c.env);
  const history = await db.select().from(healthTestResults)
    .orderBy(desc(healthTestResults.createdAt)).limit(50).execute();
  return c.json(history, 200);
});

// POST /api/health/tests — register a dynamic test definition
healthRoutes.openapi(createRoute({
  method: "post", path: "/tests", operationId: "registerHealthTest",
  request: { body: { content: { "application/json": { schema: HealthTestDefinitionSchema } } } },
  responses: { 200: { description: "Registered.", content: { "application/json": { schema: z.object({ success: z.boolean(), id: z.string() }) } } } },
}), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env);
  const id = crypto.randomUUID();
  await db.insert(healthTestDefinitions).values({
    id, ...body, createdAt: new Date(), updatedAt: new Date(),
  }).execute();
  return c.json({ success: true, id }, 200);
});
