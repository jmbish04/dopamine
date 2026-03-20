import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { reflections } from "@/db/schemas";

export const getReflections = async (env: Env) => {
  const db = getDb(env);
  return await db.select().from(reflections).orderBy(desc(reflections.createdAt)).all();
};

export const createReflection = async (env: Env, prompt: string, answer: string) => {
  const db = getDb(env);
  const now = Date.now();
  const id = crypto.randomUUID();
  
  const record = {
    id,
    prompt,
    answer,
    createdAt: now,
    answeredAt: answer ? now : null,
  };

  await db.insert(reflections).values(record).run();
  return record;
};
