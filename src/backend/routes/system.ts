import { apiReference } from "@scalar/hono-api-reference";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";

import { getContextPayload, getHealthPayload } from "@/api";
import { renderHealthDashboard } from "@/health";

type App = OpenAPIHono<{ Bindings: Env }>;

export const registerSystemRoutes = (app: App) => {
  app.get("/context", (c) => c.json(getContextPayload()));

  app.get("/health", async (c) => {
    const payload = await getHealthPayload(c.env);
    const wantsHtml =
      c.req.header("accept")?.includes("text/html") &&
      !c.req.header("accept")?.includes("application/json");

    if (wantsHtml) {
      return c.html(renderHealthDashboard(payload));
    }

    return c.json(payload, 200);
  });

  app.get("/docs", (c) => c.redirect("/scalar"));

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "Dopamine API",
      version: "1.0.0",
      description:
        "Unified Cloudflare Worker API for managing onion-layered tasks and triggering receipt printing over Workers VPC.",
    },
    servers: [
      {
        url: "https://dopamine.hacolby.workers.dev",
        description: "Production Environment",
      },
    ],
    tags: [
      {
        name: "Tasks",
        description: "Task creation, retrieval, and state changes.",
      },
      {
        name: "System",
        description: "Context, health, and documentation endpoints.",
      },
    ],
  });

  app.get("/swagger", swaggerUI({ url: "/openapi.json" }));
  app.get(
    "/scalar",
    apiReference({
      pageTitle: "Dopamine API",
      theme: "saturn",
      url: "/openapi.json",
    }),
  );
};
