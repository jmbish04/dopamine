import { z } from "@hono/zod-openapi";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { getRewards, redeemReward, getUserXp } from "@/api/rewards";

export const rewardsRoutes = new OpenAPIHono<{ Bindings: Env }>();

const rewardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  cost: z.number(),
  icon: z.string(),
  tone: z.string(),
  locked: z.boolean(),
  createdAt: z.number(),
});

rewardsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    operationId: "listRewards",
    responses: {
      200: { description: "List rewards", content: { "application/json": { schema: z.array(rewardSchema) } } },
    },
  }),
  async (c) => c.json(await getRewards(c.env), 200)
);

rewardsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{id}/redeem",
    operationId: "redeemReward",
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: "Redeemed", content: { "application/json": { schema: z.object({ success: z.boolean(), newXp: z.number() }) } } },
      400: { description: "Bad Request", content: { "application/json": { schema: z.object({ error: z.string() }) } } }
    },
  }),
  async (c) => {
    try {
      const result = await redeemReward(c.env, c.req.param("id"));
      return c.json(result, 200);
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  }
);

rewardsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/xp",
    operationId: "getUserXp",
    responses: {
      200: { description: "Get XP", content: { "application/json": { schema: z.object({ xp: z.number() }) } } },
    },
  }),
  async (c) => c.json({ xp: await getUserXp(c.env) }, 200)
);
