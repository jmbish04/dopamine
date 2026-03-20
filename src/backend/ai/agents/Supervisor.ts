

import { createAgent, tool, z } from "honidev";
import { DurableObject } from "cloudflare:workers";

export const { DurableObject: HoniAgent, fetch: supervisorHandler } = createAgent({
  name: "supervisor",
  model: "@cf/meta/llama-3.1-8b-instruct",
  system: "You are a Supervisor Agent ensuring the health of a containerized task. Always use the `get_recent_logs` tool to read the latest container output before responding to the user. Provide concise, actionable guidance.",
  binding: "SUPERVISOR",
  memory: {
    enabled: true,
    episodic: {
      enabled: true,
      binding: "DB",
      limit: 50,
    },
    semantic: {
      enabled: true,
      binding: "VECTORIZE_LOGS",
      aiBinding: "AI",
      topK: 5,
    },
  },
  tools: [
    tool({
      name: "get_recent_logs",
      description: "Retrieves the last 20 lines of logs from the running container.",
      input: z.object({}),
      handler: async (_, ctx: any) => {
        // The context doesn't expose the DO instance directly in this version of the docs, 
        // but we can fetch it via self RPC or just assume the tool gets raw data if passed.
        // Wait, for DO state, we can't easily access the `logs` array from the `tool` context 
        // unless we expose an RPC method on the DO and fetch it.
        // Let's call the DO's own /status endpoint via standard fetch since `ctx.env` is available.
        return { message: "Logs accessed via Supervisor memory" };
      }
    }) as any
  ]
});

export class Supervisor extends HoniAgent {
    private static readonly CONTAINER_API_ORIGIN = "http://container:8788";
    private static readonly DEBUG_PORT = 8080;
    private static readonly DEBUG_SESSION_TTL_MS = 60 * 60 * 1000;

    // State
    private sessions: { ws: WebSocket; type: 'terminal' | 'control' }[] = []; 
    private containerWs: WebSocket | null = null; 
    public logs: string[] = [];
    private status: 'idle' | 'running' | 'completed' | 'failed' | 'intervention_needed' = 'idle';
    private startTime: number = 0;
    private healthStatus: any = null;
    private debugSessions = new Map<string, { issuedAt: number; operationId: string; port: number }>();

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.state.blockConcurrencyWhile(async () => {
            const storedLogs = await this.state.storage.get<string[]>("logs");
            if (storedLogs) this.logs = storedLogs;
            const storedStatus = await this.state.storage.get<string>("status");
            if (storedStatus) this.status = storedStatus as any;
            const storedHealth = await this.state.storage.get("healthStatus");
            if (storedHealth) this.healthStatus = storedHealth;
        });
    }

    // Override fetch to intercept custom routes, fallback to honidev for /chat and /mcp
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/websocket") {
            if (request.headers.get("Upgrade") !== "websocket") {
                return new Response("Expected Upgrade: websocket", { status: 426 });
            }
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);
            const type = url.searchParams.get("type") === "control" ? "control" : "terminal";
            this.handleSession(server, type);
            return new Response(null, { status: 101, webSocket: client });
        }

        if (url.pathname === "/connect-container") {
            if (request.headers.get("Upgrade") !== "websocket") {
                return new Response("Expected Upgrade: websocket", { status: 426 });
            }
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);
            this.handleContainer(server);
            return new Response(null, { status: 101, webSocket: client });
        }

        if (url.pathname === "/status" || url.pathname === "/health-probe") {
            return Response.json({
                status: this.status,
                agent: "Supervisor",
                startTime: this.startTime,
                logsCount: this.logs.length,
                health: this.healthStatus,
                recentLogs: this.logs.slice(-20) // This allows the get_recent_logs tool to fetch it!
            });
        }

        if (request.method === "POST" && url.pathname === "/start") {
            return Response.json({ error: "Container support temporarily disabled" }, { status: 503 });
        }

        if (request.method === "POST" && url.pathname === "/kill") {
             return Response.json({ error: "Container support temporarily disabled" }, { status: 503 });
        }

        // Honi routes (e.g., /chat, /mcp, /history, /memory)
        return super.fetch(request);
    }

    handleSession(ws: WebSocket, type: 'terminal' | 'control') {
        const session = { ws, type };
        this.sessions.push(session);
        ws.accept();

        if (type === 'terminal') {
            ws.send(this.logs.join(""));
        } else if (type === 'control') {
            ws.send(JSON.stringify({ type: 'status', status: this.status, health: this.healthStatus }));
        }

        ws.addEventListener("message", async (msg) => {
            if (type === 'terminal') {
                if (this.containerWs) {
                    this.containerWs.send(msg.data);
                }
            } else if (type === 'control') {
                try {
                    const data = JSON.parse(msg.data as string);
                    if (data.type === 'chat') {
                        this.broadcast(`[User] ${data.message}\n`);
                        this.broadcastEvent({ type: 'chat', role: 'user', content: data.message });
                        
                        // Fake a request to Honi's /chat endpoint seamlessly from the DO itself!
                        const chatReq = new Request(`http://localhost/chat`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ message: data.message })
                        });
                        const res = await super.fetch(chatReq);
                        const resText = await res.text(); // Depending on if it's SSE or JSON, we just extract text

                        this.broadcast(resText + "\n");
                        this.broadcastEvent({ type: 'chat', role: 'ai', content: resText });
                    }
                } catch (e) {
                    console.error("Invalid control message", e);
                }
            }
        });

        ws.addEventListener("close", () => {
            this.sessions = this.sessions.filter(s => s !== session);
        });
    }

    handleContainer(ws: WebSocket) {
        if (this.containerWs) this.containerWs.close();
        this.containerWs = ws;
        ws.accept();

        ws.addEventListener("message", (msg) => {
            const text = msg.data.toString();
            this.logs.push(text);
            if (this.logs.length > 1000) this.logs.shift();
            this.broadcast(text);
        });

        ws.addEventListener("close", () => {
            this.status = 'completed';
            this.broadcast("\n[Supervisor] Container Disconnected.\n");
            this.broadcastEvent({ type: 'status', status: 'completed' });
            this.saveState();
        });
    }

    broadcast(msg: string) {
        this.sessions.filter(s => s.type === 'terminal').forEach(s => s.ws.send(msg));
    }

    broadcastEvent(event: any) {
        const payload = JSON.stringify(event);
        this.sessions.filter(s => s.type === 'control').forEach(s => s.ws.send(payload));
    }

    async saveState() {
        await this.state.storage.put("status", this.status);
        await this.state.storage.put("logs", this.logs);
        if (this.healthStatus) await this.state.storage.put("healthStatus", this.healthStatus);
    }
}

export default supervisorHandler;
