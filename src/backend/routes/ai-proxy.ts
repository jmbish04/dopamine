import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getAiGatewayToken, getWorkerApiKey } from "@/utils/secrets";

export const aiProxyRoutes = new OpenAPIHono<{ Bindings: Env }>();

const proxyRequestRoute = createRoute({
  method: "post",
  path: "/{provider}/*",
  operationId: "proxyAiRequest",
  description: "Proxies an AI request to the Cloudflare AI Gateway universal endpoint, securely injecting keys.",
  request: {
    params: z.object({
      provider: z.string().describe("The AI provider (e.g. 'workers-ai', 'openai', 'anthropic')")
    }),
  },
  responses: {
    200: {
      description: "Successful proxy response from the AI provider.",
    },
    500: {
      description: "Gateway error or failing provider.",
    }
  },
});

aiProxyRoutes.openapi(proxyRequestRoute, async (c) => {
  try {
    const { provider } = c.req.valid("param");
    const gatewayId = c.env.AI_GATEWAY_NAME || "default-gateway";
    
    // Determine the exact subpath after the provider 
    // e.g. /api/proxy/workers-ai/chat/completions -> /chat/completions
    const url = new URL(c.req.url);
    const pathParts = url.pathname.split(`/api/proxy/${provider}`);
    const remainingPath = pathParts.length > 1 ? pathParts[1] : "";

    const gatewayToken = await getAiGatewayToken(c.env);
    const cfApiKey = await getWorkerApiKey(c.env);

    // AI Gateway Universal Endpoint formula:
    // https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/{provider}
    const gatewayUrl = `${await c.env.AI.gateway(gatewayId).getUrl(provider)}/${remainingPath}`;

    // Determine the auth header needed by the specific provider.
    // We inject the CF gateway token as a custom header, and the native API key for the provider in Authorization.
    const headers = new Headers(c.req.raw.headers);
    headers.set("cf-aig-authorization", `Bearer ${gatewayToken}`);
    
    if (provider === "workers-ai") {
      headers.set("Authorization", `Bearer ${cfApiKey}`);
    } else {
       // Note: To support direct openai/anthropic calls, the Python script must still pass `Authorization: Bearer <OPENAI_KEY>`
       // The proxy handles the *Gateway* authentication universally.
    }

    // Strip out host and connection headers so fetch doesn't get confused
    headers.delete("host");
    headers.delete("connection");

    const response = await fetch(gatewayUrl, {
      method: c.req.method,
      headers,
      body: c.req.raw.body,
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.delete("content-encoding");

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500) as any;
  }
});
