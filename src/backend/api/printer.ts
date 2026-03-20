import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { printJobs } from "@/db/schemas";

// In-memory store for WebSocket connections (per-isolate)
export const printerConnections = new Set<WebSocket>();

export const getPendingJobs = async (env: Env) => {
  const db = getDb(env);
  return await db.select().from(printJobs).where(eq(printJobs.status, "pending")).orderBy(desc(printJobs.createdAt)).all();
};

export const acknowledgeJob = async (env: Env, jobId: string) => {
  const db = getDb(env);
  await db.update(printJobs).set({ status: "printed" }).where(eq(printJobs.id, jobId)).run();
  return { success: true };
};

export const broadcastToPrinters = async (env: Env, jobId: string, taskId: string, title: string, dueDate?: string) => {
  const payload = {
    type: "print_job",
    jobId,
    taskId,
    title,
    dueDate
  };

  const id = env.PRINTER_HUB.idFromName("global-printer-hub");
  const stub = env.PRINTER_HUB.get(id);

  try {
    await stub.fetch(new Request("https://dopamine/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload) // You can optionally define target_tag handling if needed
    }));
  } catch (err) {
    console.error("Failed to broadcast print job to DO", err);
  }
};
