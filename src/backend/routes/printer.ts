import { z } from "@hono/zod-openapi";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { getPendingJobs, acknowledgeJob } from "@/api/printer";
import { getDb } from "@/db";
import { tasks } from "@/db/schemas/tasks";
import { systemState } from "@/db/schemas/system";
import { eq } from "drizzle-orm";
import { getCurrentPSTMillis } from "@/utils/date";

export const printerRoutes = new OpenAPIHono<{ Bindings: Env }>();

const pendingJobSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  title: z.string(),
  status: z.enum(["pending", "printed"]),
  createdAt: z.number()
});

const hardwareReportSchema = z.object({
  status: z.string(),
  printer: z.string(),
  network: z.string().optional(),
  timestamp: z.number(),
  error: z.string().optional()
});

const telemetrySchema = z.object({
  timestamp: z.number(),
  level: z.enum(["INFO", "WARN", "ERROR"]).or(z.string()).optional(),
  message: z.string().optional(),
  status: z.string().optional(),
  printer: z.string().optional(),
  network: z.string().optional(),
  error: z.string().optional()
});

printerRoutes.openapi(
  createRoute({
    method: "get",
    path: "/pending",
    operationId: "getPendingJobs",
    responses: {
      200: { description: "List of pending jobs", content: { "application/json": { schema: z.array(pendingJobSchema) } } }
    }
  }),
  async (c) => c.json(await getPendingJobs(c.env), 200)
);

printerRoutes.openapi(
  createRoute({
    method: "post",
    path: "/ack",
    operationId: "acknowledgeJob",
    request: {
      body: { content: { "application/json": { schema: z.object({ job_id: z.string() }) } } }
    },
    responses: {
      200: { description: "Job Acknowledged", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } }
    }
  }),
  async (c) => {
    const { job_id } = await c.req.json();
    return c.json(await acknowledgeJob(c.env, job_id), 200);
  }
);

printerRoutes.openapi(
  createRoute({
    method: "post",
    path: "/test",
    operationId: "triggerHardwareTest",
    responses: {
      200: { description: "Test result", content: { "application/json": { schema: hardwareReportSchema } } }
    }
  }),
  async (c) => {
    try {
      if (!c.env.PRINTER_VPC) {
        throw new Error("PRINTER_VPC binding missing");
      }
      const res = await c.env.PRINTER_VPC.fetch("http://127.0.0.1:8080/test", { method: "POST" });
      const data = await res.json();
      return c.json(data as z.infer<typeof hardwareReportSchema>, 200);
    } catch (e) {
      return c.json({
        status: "offline",
        printer: "unreachable",
        timestamp: Date.now(),
        error: e instanceof Error ? e.message : String(e)
      }, 200);
    }
  }
);

printerRoutes.openapi(
  createRoute({
    method: "post",
    path: "/telemetry",
    operationId: "logHardwareTelemetry",
    request: {
      body: { content: { "application/json": { schema: telemetrySchema } } }
    },
    responses: {
      200: { description: "Telemetry Logged", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } }
    }
  }),
  async (c) => {
    const report = await c.req.json();
    const { Logger } = await import("@/logging");
    
    let level = "INFO";
    let message = report.message || "";
    
    if (report.status) {
      level = report.status === "offline" || report.status === "degraded" ? "ERROR" : "INFO";
      message = `Diagnostic Report: ${report.status} - ${report.printer}`;
      if (report.error) message += ` | Error: ${report.error}`;
    } else if (report.level) {
      level = ["INFO", "WARN", "ERROR"].includes(report.level) ? report.level : "INFO";
    }
    
    // Cloudflare Workers will kill the isolate when the response is returned if we do not await or use waitUntil
    await Logger.log(level as any, message, c.env, {
      module: "raspberry_pi",
      event: report.status ? "hardware_diagnostic" : "hardware_log",
      data: report,
      source: "python"
    });

    // Stamp last-seen timestamp for health check
    await c.env.KV.put("pi:last_telemetry_ts", String(Date.now()), { expirationTtl: 60 * 60 * 24 * 7 });
    
    return c.json({ success: true }, 200);
  }
);

printerRoutes.openapi(
  createRoute({
    method: "get",
    path: "/device-logs",
    operationId: "getDeviceLogs",
    request: {
      query: z.object({ lines: z.string().optional() })
    },
    responses: {
      200: { description: "Device Logs", content: { "application/json": { schema: z.object({ status: z.string().optional(), logs: z.string() }) } } }
    }
  }),
  async (c) => {
    try {
      if (!c.env.PRINTER_VPC) {
        throw new Error("PRINTER_VPC binding missing");
      }
      const { lines } = c.req.valid("query");
      const query = lines ? `?lines=${lines}` : "?lines=50";
      const res = await c.env.PRINTER_VPC.fetch(`http://127.0.0.1:8080/logs${query}`, { method: "GET" });
      const data = await res.json();
      return c.json(data as { status?: string; logs: string }, 200);
    } catch (e) {
      return c.json({
        status: "offline",
        logs: "Cannot reach device over VPC tunnel."
      }, 200);
    }
  }
);

// WebSocket endpoint mapped to Durable Object
printerRoutes.get("/ws", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  // Create a stable DO ID. We'll use a single hub instance for simplicity.
  const id = c.env.PRINTER_HUB.idFromName("global-printer-hub");
  const stub = c.env.PRINTER_HUB.get(id);
  
  // Forward the request natively to the Durable Object to persist
  return stub.fetch(c.req.raw);
});

// Barcode Scanner Ingestion
printerRoutes.openapi(
  createRoute({
    method: "post",
    path: "/scan",
    operationId: "reportHardwareScan",
    request: {
      body: { content: { "application/json": { schema: z.object({ scanned_code: z.string() }) } } }
    },
    responses: {
      200: { 
        description: "Scan Broadcasted", 
        content: { 
          "application/json": { 
            schema: z.object({ 
              success: z.boolean(),
              action: z.string(),
              task: z.any()
            }) 
          } 
        } 
      },
      400: { description: "Bad Request", content: { "application/json": { schema: z.object({ success: z.boolean(), action: z.string(), task: z.any() }) } } },
      500: { description: "Internal Server Error", content: { "application/json": { schema: z.object({ success: z.boolean(), action: z.string(), task: z.any() }) } } }
    }
  }),
  async (c) => {
    const { scanned_code } = await c.req.json();
    const db = getDb(c.env);

    let action = "focus";
    let updatedTask = null;

    try {
      if (scanned_code.startsWith("CMD:")) {
        // 1. Fetch the globally active task
        const state = await db.select().from(systemState).where(eq(systemState.id, "global_session")).get();
        if (!state || !state.activeTaskId) return c.json({ success: false, action: "error", task: null }, 400);

        const activeTask = await db.select().from(tasks).where(eq(tasks.id, state.activeTaskId)).get();
        if (!activeTask) return c.json({ success: false, action: "error", task: null }, 400);

        const now = Math.floor(Date.now() / 1000);
        const updateMillis = getCurrentPSTMillis();

        // 2. Process Command
        if (scanned_code === "CMD:PLAY") {
          action = "play";
          [updatedTask] = await db.update(tasks)
            .set({ status: "in_progress", lastStartedAt: now, updatedAt: updateMillis })
            .where(eq(tasks.id, activeTask.id))
            .returning();
        } else if (scanned_code === "CMD:PAUS") {
          action = "pause";
          const timeElapsed = activeTask.lastStartedAt ? now - activeTask.lastStartedAt : 0;
          [updatedTask] = await db.update(tasks)
            .set({ 
              status: "paused", 
              timeSpent: (activeTask.timeSpent || 0) + timeElapsed, 
              lastStartedAt: null, 
              updatedAt: updateMillis 
            })
            .where(eq(tasks.id, activeTask.id))
            .returning();
        } else if (scanned_code === "CMD:DONE") {
          action = "done";
          const timeElapsed = activeTask.lastStartedAt ? now - activeTask.lastStartedAt : 0;
          [updatedTask] = await db.update(tasks)
            .set({ 
              status: "done", 
              timeSpent: (activeTask.timeSpent || 0) + timeElapsed, 
              lastStartedAt: null, 
              completedAt: updateMillis,
              updatedAt: updateMillis
            })
            .where(eq(tasks.id, activeTask.id))
            .returning();
        }
      } else {
        // It's a Task ID -> Set as globally active
        action = "focus";
        const existing = await db.select().from(systemState).where(eq(systemState.id, "global_session")).get();
        
        if (existing) {
          await db.update(systemState).set({ activeTaskId: scanned_code }).where(eq(systemState.id, "global_session"));
        } else {
          await db.insert(systemState).values({ id: "global_session", activeTaskId: scanned_code });
        }
        updatedTask = await db.select().from(tasks).where(eq(tasks.id, scanned_code)).get();
      }

      // 3. Broadcast to the Frontend via Durable Object
      const id = c.env.PRINTER_HUB.idFromName("global-printer-hub"); // match our /ws structure
      const stub = c.env.PRINTER_HUB.get(id);
      await stub.fetch(new Request("http://internal/broadcast", {
        method: "POST",
        body: JSON.stringify({ type: "ui_sync", action, task: updatedTask }),
      }));

      return c.json({ success: true, action, task: updatedTask }, 200);
      
    } catch(err) {
      console.error(err);
      return c.json({ success: false, action: "error", task: null }, 500);
    }
  }
);

printerRoutes.openapi(
  createRoute({
    method: "get",
    path: "/print-commands",
    operationId: "printCommands",
    responses: {
      200: { description: "Receipt Printed", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } },
      500: { description: "Internal Server Error", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } }
    }
  }),
  async (c) => {
    try {
      if (!c.env.PRINTER_VPC) throw new Error("PRINTER_VPC binding missing");
      const res = await c.env.PRINTER_VPC.fetch("http://127.0.0.1:8080/print-commands", { method: "GET" });
      if (!res.ok) throw new Error("VPC returned non-ok status");
      return c.json({ success: true }, 200);
    } catch (e) {
      console.error(e);
      return c.json({ success: false }, 500);
    }
  }
);

// Local Python Script AI Assistant Endpoint
printerRoutes.openapi(
  createRoute({
    method: "post",
    path: "/ai",
    operationId: "runPythonDiagAi",
    request: {
      body: { 
        content: { 
          "application/json": { 
            schema: z.object({ 
              prompt: z.string(),
              schema: z.any().optional(), // structured JSON schema
              model: z.string().optional()
            }) 
          } 
        } 
      }
    },
    responses: {
      200: { description: "AI Response", content: { "application/json": { schema: z.object({ success: z.boolean(), response: z.any() }) } } },
      500: { description: "Internal Server Error", content: { "application/json": { schema: z.object({ success: z.boolean(), error: z.string() }) } } }
    }
  }),
  async (c) => {
    try {
      const { prompt, schema, model } = await c.req.json();
      const targetModel = model || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
      
      const aiRequest: any = {
        prompt: prompt,
      };

      if (schema) {
        aiRequest.response_format = {
          type: "json_schema",
          json_schema: typeof schema === "string" ? JSON.parse(schema) : schema
        };
      }

      const rawResponse = await c.env.AI.run(targetModel as any, aiRequest);
      let result = (rawResponse as any).response;
      
      // Auto-parse if the result returned a string despite us asking for a schema
      if (schema && typeof result === "string") {
        try {
          result = JSON.parse(result);
        } catch (e) {
          // Fallback to unstructured if parser fails
        }
      }

      return c.json({ success: true, response: result }, 200);
    } catch (err) {
      console.error(err);
      return c.json({ success: false, error: String(err) }, 500);
    }
  }
);
