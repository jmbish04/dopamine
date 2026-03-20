import { OpenAPIHono } from "@hono/zod-openapi";
import { drizzle } from "drizzle-orm/d1";
import { eq, or, isNull } from "drizzle-orm";

import { Logger } from "@/logging";
import { registerRoutes } from "@/routes";
import { heroImages } from "@/db/schemas/hero_images";
import { runHealthSuite } from "@/health/service";

// @ts-ignore - The dist directory is generated after compilation step
import astroApp from "../../dist/client/_worker.js/index.js";

// Import Agent Handlers & Classes
import plannerHandler, { PlannerAgent } from "@/ai/agents/Planner";
import supervisorHandler, { Supervisor } from "@/ai/agents/Supervisor";
import spotifyHandler, { SpotifyAgent } from "@/ai/agents/SpotifyAgent";
import emailHandler, { EmailAgent } from "@/ai/agents/EmailAgent";
export { MotivationalAgent } from "@/ai/agents/MotivationalAgent";
export { SpotifySyncHub } from "./durable_objects/SpotifySyncHub";

const app = new OpenAPIHono<{ Bindings: Env }>();

registerRoutes(app);

// Mount Honi Agent APIs
// honidev returns a plain ExportedHandlerFetchHandler, not a Hono sub-router.
// Proxy each prefix via app.all() — strip the mount prefix before forwarding.
function mountAgent(prefix: string, handler: ExportedHandlerFetchHandler<Env>) {
  app.all(`${prefix}/*`, async (c) => {
    const url = new URL(c.req.url);
    url.pathname = url.pathname.slice(prefix.length) || "/";
    const req = new Request(url.toString(), c.req.raw);
    return handler(req as any, c.env, c.executionCtx as ExecutionContext);
  });
}

mountAgent("/api/agents/planner", plannerHandler);
mountAgent("/api/agents/supervisor", supervisorHandler);
mountAgent("/api/agents/spotify", spotifyHandler);
mountAgent("/api/agents/email", emailHandler);

app.all("*", async (c) => {
  try {
    return await astroApp.fetch(c.req.raw, c.env, c.executionCtx);
  } catch (error) {
    await Logger.error("Astro SSR Fetch Failed", c.env, {
      module: "astro_ssr",
      event: "fetch_failed",
      request: c.req.raw,
      data: { path: c.req.path },
      error,
    });
    return c.text("Frontend render failed.", 500);
  }
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // ── Weekly health scan (cron: "0 8 * * 1") ──
    ctx.waitUntil(
      runHealthSuite(env, "cron").catch((e) =>
        console.error("Cron health suite failed:", e)
      )
    );

    // ── Hero image cleanup (90-day prune) ──
    const db = drizzle(env.DB);
    const ninetyDaysAgoTs = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
    const imagesToClean = await db.select().from(heroImages).where(
      or(eq(heroImages.rating, "down"), isNull(heroImages.rating))
    );
    const oldImages = imagesToClean.filter((img) => (img.createdAt as any) < ninetyDaysAgoTs);
    for (const img of oldImages) {
      try {
        await db.delete(heroImages).where(eq(heroImages.id, img.id));
        console.log(`Pruned stale hero image ${img.id}`);
      } catch (e) {
        console.error(`Failed to prune image ${img.id}`, e);
      }
    }
  },
};

// Export Durable Objects required by wrangler.jsonc
export { PlannerAgent, Supervisor, SpotifyAgent, EmailAgent };
export { PrinterHub } from "./durable_objects/PrinterHub";
export { SpotifyOAuthStore } from "./durable_objects/SpotifyOAuthStore";



