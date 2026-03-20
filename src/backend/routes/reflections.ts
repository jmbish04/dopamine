import { z } from "@hono/zod-openapi";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { getReflections, createReflection } from "@/api/reflections";

export const reflectionsRoutes = new OpenAPIHono<{ Bindings: Env }>();

const reflectionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  answer: z.string().nullable(),
  createdAt: z.number(),
  answeredAt: z.number().nullable(),
});

reflectionsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    operationId: "listReflections",
    responses: {
      200: { description: "List reflections", content: { "application/json": { schema: z.array(reflectionSchema) } } },
    },
  }),
  async (c) => c.json(await getReflections(c.env), 200)
);

reflectionsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    operationId: "createReflection",
    request: {
      body: { content: { "application/json": { schema: z.object({ prompt: z.string(), answer: z.string() }) } } },
    },
    responses: {
      200: { description: "Created", content: { "application/json": { schema: reflectionSchema } } },
    },
  }),
  async (c) => {
    const { prompt, answer } = await c.req.json();
    const result = await createReflection(c.env, prompt, answer);
    return c.json(result, 200);
  }
);
