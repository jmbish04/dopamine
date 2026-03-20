import { OpenAPIHono } from "@hono/zod-openapi";

import { healthRoutes } from "@/routes/health";
import { registerSystemRoutes } from "@/routes/system";
import { tasksRoutes } from "@/routes/tasks";
import { rewardsRoutes } from "@/routes/rewards";
import { reflectionsRoutes } from "@/routes/reflections";
import { printerRoutes } from "@/routes/printer";
import { spotifyRoutes } from "@/backend/routes/spotify";
import { sessionRoutes } from "@/routes/session";
import { aiProxyRoutes } from "@/routes/ai-proxy";

type App = OpenAPIHono<{ Bindings: Env }>;

export const registerRoutes = (app: App) => {
  app.route("/api/tasks", tasksRoutes);
  app.route("/api/rewards", rewardsRoutes);
  app.route("/api/reflections", reflectionsRoutes);
  app.route("/api/printer", printerRoutes);
  app.route("/api/spotify", spotifyRoutes);
  app.route("/api/health", healthRoutes);
  app.route("/api/session", sessionRoutes);
  app.route("/api/ai-proxy", aiProxyRoutes);
  registerSystemRoutes(app);
};

export * from "@/routes/health";
export * from "@/routes/system";
export * from "@/routes/tasks";
export * from "@/routes/rewards";
export * from "@/routes/reflections";
export * from "@/routes/printer";
export * from "@/backend/routes/spotify";
export * from "@/routes/session";
