import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rewards, userProfile } from "@/db/schemas";

export const getRewards = async (env: Env) => {
  const db = getDb(env);
  const items = await db.select().from(rewards).all();
  if (items.length === 0) {
    const now = Date.now();
    // seed initial
    const initialRewards = [
      { id: "r1", title: "5-minute dance break", description: "Fast refuel, high BPM, zero guilt.", cost: 100, icon: "Headphones", tone: "text-onion-cyan", locked: false, createdAt: now },
      { id: "r2", title: "15-minute outside walk", description: "Reset sensory load and force a horizon stare.", cost: 300, icon: "Trees", tone: "text-emerald-400", locked: false, createdAt: now },
      { id: "r3", title: "New dashboard theme", description: "Cosmetic payoff for stacking consistent wins.", cost: 2000, icon: "Palette", tone: "text-onion-orange", locked: true, createdAt: now },
    ];
    await db.insert(rewards).values(initialRewards).run();
    return initialRewards;
  }
  return items;
};

export const redeemReward = async (env: Env, rewardId: string) => {
  const db = getDb(env);
  const reward = await db.select().from(rewards).where(eq(rewards.id, rewardId)).get();
  if (!reward) throw new Error("Reward not found");

  const profile = await db.select().from(userProfile).where(eq(userProfile.id, "user_1")).get();
  const currentXp = profile?.xp ?? 0;

  if (currentXp < reward.cost) {
    throw new Error("Not enough XP");
  }

  await db.update(userProfile).set({ xp: currentXp - reward.cost }).where(eq(userProfile.id, "user_1")).run();
  return { success: true, newXp: currentXp - reward.cost };
};

export const getUserXp = async (env: Env) => {
  const db = getDb(env);
  const profile = await db.select().from(userProfile).where(eq(userProfile.id, "user_1")).get();
  if (!profile) {
    await db.insert(userProfile).values({ id: "user_1", xp: 1250 }).run(); 
    return 1250;
  }
  return profile.xp;
};
