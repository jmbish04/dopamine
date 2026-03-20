import { desc, eq } from "drizzle-orm";
import { 
  getCurrentPSTMillis, 
  getAnalyticsLookbackSeries, 
  parsePSTDateToMillis, 
  formatMillisToPSTISO, 
  getPSTDateTimeFromMillis 
} from "@/utils/date";

import { getDb } from "@/db";
import { tasks, type TaskStatus } from "@/db/schemas/tasks";
import { printJobs } from "@/db/schemas/printer";
import { broadcastToPrinters } from "@/api/printer";
import { Logger } from "@/logging";
import { routeToAgent } from "honidev";

export type TaskRecord = typeof tasks.$inferSelect;
export type SerializedTask = ReturnType<typeof serializeTask>;
export type PrinterDispatchResult = { ok: boolean; status: "sent" | "failed" };

export type CreateTaskInput = {
  title: string;
  notes?: string;
  layer?: number;
  xp?: number;
  dueDate?: string;
};

export type TaskAnalytics = {
  date: string;
  completed: number;
  xpEarned: number;
  added: number;
}[];

export type UpdateTaskStatusInput = {
  id: string;
  status: TaskStatus;
};

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateTaskId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
};

const serializeTask = (task: TaskRecord) => ({
  ...task,
  createdAt: formatMillisToPSTISO(task.createdAt),
  updatedAt: formatMillisToPSTISO(task.updatedAt),
  completedAt: task.completedAt ? formatMillisToPSTISO(task.completedAt) : null,
  dueDate: task.dueDate ? formatMillisToPSTISO(task.dueDate) : null,
});

const sendReceiptToPrinter = async (
  env: Env,
  task: typeof tasks.$inferInsert,
): Promise<PrinterDispatchResult> => {
  if (!env.PRINTER_VPC) {
    return { ok: false, status: "failed" };
  }

  const response = await env.PRINTER_VPC.fetch("http://127.0.0.1:8080/print", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: task.id,
      title: task.title,
      notes: task.notes,
      qrCodeValue: task.receiptQrValue,
      xp: task.xp,
      layer: task.layer,
      dueDate: task.dueDate ? formatMillisToPSTISO(task.dueDate) : undefined,
    }),
  });

  return {
    ok: response.ok,
    status: response.ok ? "sent" : "failed",
  };
};

export const listTasks = async (env: Env, status?: TaskStatus) => {
  const db = getDb(env);
  const rows = status
    ? await db.select().from(tasks).where(eq(tasks.status, status)).orderBy(desc(tasks.createdAt))
    : await db.select().from(tasks).orderBy(desc(tasks.createdAt));

  return rows.map(serializeTask);
};

export const getTask = async (env: Env, id: string) => {
  const task = await getDb(env).select().from(tasks).where(eq(tasks.id, id)).get();
  return task ? serializeTask(task) : null;
};

export const createTask = async (env: Env, input: CreateTaskInput, request?: Request) => {
  const db = getDb(env);
  const now = getCurrentPSTMillis();
  const id = generateTaskId();
  const record = {
    id,
    title: input.title,
    notes: input.notes ?? null,
    status: "open" as const,
    layer: input.layer ?? 1,
    xp: input.xp ?? 25,
    receiptQrValue: `onion-tasker://task/${id}`,
    printStatus: "queued" as const,
    timeSpent: 0,
    lastStartedAt: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    dueDate: input.dueDate ? parsePSTDateToMillis(input.dueDate) : null,
    position: 0,
  };

  await db.insert(tasks).values(record).run();
  await Logger.info("Task created", env, {
    module: "tasks",
    event: "create",
    request,
    data: {
      id,
      title: record.title,
      layer: record.layer,
      xp: record.xp,
    },
  });

  let printer: PrinterDispatchResult = { ok: false, status: "failed" };

  // Start Cascade Action for Printer (VPC -> WS -> DB)
  const jobId = crypto.randomUUID();
  const printJobRecord = {
    id: jobId,
    taskId: id,
    title: record.title,
    status: "pending" as const,
    createdAt: now,
  };
  await db.insert(printJobs).values(printJobRecord).run();

  try {
    if (env.PRINTER_VPC) {
      const vpcResponse = await env.PRINTER_VPC.fetch("http://127.0.0.1:8080/print", {
        method: "POST",
        body: JSON.stringify({ title: record.title, id: record.id }),
        headers: { "Content-Type": "application/json" }
      });
      
      if (vpcResponse.ok) {
        // Attempt 1 Success
        await db.update(printJobs).set({ status: "printed" }).where(eq(printJobs.id, jobId)).run();
        printer.ok = true;
        printer.status = "sent";
      } else {
        throw new Error(`VPC returned ${vpcResponse.status}`);
      }
    } else {
       throw new Error("PRINTER_VPC binding not configured");
    }
  } catch (error) {
    // Attempt 2: WebSocket Broadcast via DO
    try {
      const dueDateIso = record.dueDate ? formatMillisToPSTISO(record.dueDate) : undefined;
      await broadcastToPrinters(env, jobId, record.id, record.title, dueDateIso ?? undefined);
      // We leave status as 'pending' for the printer to /ack back to via REST.
      printer.ok = true;
      printer.status = "sent"; // Optimistically mapping UI state.
    } catch (wsError) {
      // Attempt 3: Leave as 'pending' for REST Polling automatically. Output a failed log so UI knows to show offline.
      printer.ok = false;
      printer.status = "failed";
    }

    if (printer.status === "failed") {
      await Logger.error("Printer dispatch failed down to level 3 polling", env, {
        module: "tasks",
        event: "print_dispatch_fallback",
        request,
        data: { id },
        error,
      });
    }
  }

  // Update tasks table with the result of the printer cascade
  await db
    .update(tasks)
    .set({
      printStatus: printer.status,
      updatedAt: getCurrentPSTMillis(),
    })
    .where(eq(tasks.id, id))
    .run();

  const saved = await db.select().from(tasks).where(eq(tasks.id, id)).get();

  return {
    task: serializeTask(saved ?? { ...record, printStatus: printer.status, originalContent: null, dueDate: record.dueDate }),
    printer,
  };
};

export const updateTaskStatus = async (
  env: Env,
  input: UpdateTaskStatusInput,
  request?: Request,
) => {
  const db = getDb(env);
  const existing = await db.select().from(tasks).where(eq(tasks.id, input.id)).get();

  if (!existing) {
    return null;
  }

  const now = getCurrentPSTMillis();
  await db
    .update(tasks)
    .set({
      status: input.status,
      updatedAt: now,
      completedAt: input.status === "done" ? now : null,
    })
    .where(eq(tasks.id, input.id))
    .run();

  const updated = await db.select().from(tasks).where(eq(tasks.id, input.id)).get();

  await Logger.info("Task status updated", env, {
    module: "tasks",
    event: "status_update",
    request,
    data: {
      id: input.id,
      status: input.status,
    },
  });

  return serializeTask(updated ?? existing);
};

export const generateTaskAudio = async (env: Env, task: SerializedTask, action: string): Promise<string | null> => {
  try {
    // 1. Get motivation transcript from our Honi Agent
    const prompt = `Task '${task.title}' has been ${action}. ${task.xp ? `XP: ${task.xp}` : ""}`;
    
    const motivationRes = await routeToAgent(env, { binding: "MOTIVATIONAL_AGENT" }, prompt);
    const motivationRes = await routeToAgent(env as any, { binding: "MOTIVATIONAL_AGENT" }, prompt) as any;
    
    // Safe extraction if motivationRes is a Response object or direct text
    const textResult = typeof motivationRes === "object" && motivationRes.text 
      ? await motivationRes.text() 
      : typeof motivationRes === "string" ? motivationRes : JSON.stringify(motivationRes);
    
    // Parse honidev's standard response format just in case it's stringified JSON
    let transcript = `Task ${task.title} has been ${action}. Let's go!`;
    try {
        const parsed = typeof textResult === "string" && textResult.startsWith("{") ? JSON.parse(textResult) : null;
        if (parsed && parsed.response?.messages) {
            transcript = parsed.response.messages[0]?.content || parsed.response;
        } else if (textResult && textResult.length > 0) {
            transcript = textResult; 
        }
    } catch {
        transcript = textResult || transcript;
    }
    
    // 2. Synthesize audio on Cloudflare's deepgram TTS edge runner
    const aiRes = await env.AI.run("@cf/deepgram/aura-luna-en" as any, { text: transcript });
    
    // The AI binding returns a raw Uint8Array for audio
    if (!(aiRes instanceof Uint8Array)) {
      throw new Error("Invalid audio response from AI");
    }

    // 3. Convert binary output to base64
    return btoa(String.fromCharCode(...aiRes));
  } catch (err: any) {
    console.error("TTS Pipeline failed:", err);
    await Logger.error("Task Completion Audio Failed", env, { module: "tasks", event: "tts_error", request: undefined, data: { err: err.message } });
    return null;
  }
};

export const updateTaskOrder = async (
  env: Env,
  items: { id: string; status: TaskStatus; position: number }[],
) => {
  const db = getDb(env);
  const now = getCurrentPSTMillis();

  if (items.length === 0) {
    return { success: true };
  }

  const batchQueries = items.map((item) =>
    db
      .update(tasks)
      .set({
        status: item.status,
        position: item.position,
        updatedAt: now,
        ...(item.status === "done" ? { completedAt: now } : {}),
      })
      .where(eq(tasks.id, item.id))
  );

  // @ts-ignore - Drizzle batch typings for map
  await db.batch(batchQueries);

  return { success: true };
};

export const getTaskAnalytics = async (env: Env): Promise<TaskAnalytics> => {
  const db = getDb(env);
  // Fetch all tasks using pure Drizzle, no raw SQL
  const allTasks = await db.select().from(tasks).run();
  
  // Build a 7-day lookback window
  const series = getAnalyticsLookbackSeries(7);

  const getDayKey = (timestamp: number) => {
    if (!timestamp) return null;
    // Handle both millisecond (13-digit) and standard Unix seconds (10-digit) epochs
    const safeTimestamp = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
    const d = getPSTDateTimeFromMillis(safeTimestamp);
    
    // Check for invalid date
    if (!d.isValid) return null;

    return d.toISODate();
  };


  for (const task of allTasks.results || allTasks) {
    const t = task as TaskRecord;
    
    // Track added
    const createdKey = getDayKey(t.createdAt);
    if (createdKey && series[createdKey]) {
      series[createdKey].added += 1;
    }

    // Track completed & xp
    if (t.completedAt) {
      const completedKey = getDayKey(t.completedAt);
      if (completedKey && series[completedKey]) {
        series[completedKey].completed += 1;
        series[completedKey].xpEarned += t.xp;
      }
    }
  }

  return Object.values(series);
};

export const getAdhdBurndownStats = async (env: Env) => {
  const db = getDb(env);
  const allTasks = await db.select().from(tasks).run();
  
  const now = getCurrentPSTMillis();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  const payload = {
    completedToday: [] as SerializedTask[],
    completedLast3Days: [] as SerializedTask[],
    completedLast7Days: [] as SerializedTask[],
    remainingTasks: [] as SerializedTask[],
  };

  for (const task of allTasks.results || allTasks) {
    const t = task as TaskRecord;
    const serialized = serializeTask(t);
    
    if (t.status === "done" && t.completedAt) {
      const elapsed = now - t.completedAt;
      if (elapsed <= ONE_DAY) {
        payload.completedToday.push(serialized);
      } else if (elapsed <= ONE_DAY * 3) {
        payload.completedLast3Days.push(serialized);
      } else if (elapsed <= ONE_DAY * 7) {
        payload.completedLast7Days.push(serialized);
      }
    } else if (t.status === "open" || t.status === "in_progress" || t.status === "paused") {
      payload.remainingTasks.push(serialized);
    }
  }

  // Sort remaining tasks by priority (layer descending, XP descending)
  payload.remainingTasks.sort((a, b) => {
    if (a.layer !== b.layer) return b.layer - a.layer;
    return b.xp - a.xp;
  });

  return payload;
};
