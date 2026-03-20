import { DurableObject } from "cloudflare:workers";

export class PrinterHub extends DurableObject {
  private sessions: Set<WebSocket> = new Set();
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Support broadcasting from internal worker endpoints
    if (request.method === "POST" && url.pathname === "/broadcast") {
      const body = await request.json() as any;
      this.broadcast(body);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    if (request.headers.get("Upgrade") === "websocket") {
      const { 0: client, 1: server } = new WebSocketPair();
      
      const clientType = url.searchParams.get("client") || "printer"; // "ui" or "printer"
      
      this.ctx.acceptWebSocket(server, [clientType]);
      this.sessions.add(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not found", { status: 404 });
  }

  broadcast(message: any, targetTag?: string) {
    const payload = JSON.stringify(message);
    const sockets = this.ctx.getWebSockets();
    
    sockets.forEach((ws) => {
      // If a targetTag is provided, only send to websockets having that tag.
      if (targetTag) {
        const tags = this.ctx.getTags(ws);
        if (!tags.includes(targetTag)) {
          return;
        }
      }
      
      try {
        ws.send(payload);
      } catch (err) {
        ws.close();
      }
    });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // We could handle incoming socket messages here if needed natively parsing
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.sessions.delete(ws);
  }

  webSocketError(ws: WebSocket, error: unknown) {
    this.sessions.delete(ws);
  }
}
