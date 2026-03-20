import { DurableObject } from "cloudflare:workers";


export class SpotifySyncHub extends DurableObject {
  private sessions: Set<WebSocket> = new Set();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    
    this.ctx.acceptWebSocket(server, ["spotify-sync"]);
    this.sessions.add(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  public async broadcast(state: any): Promise<void> {
    const payload = JSON.stringify({ type: "SYNC_PLAYBACK_STATE", state });
    
    // Broadcast to all connected sockets
    const sockets = this.ctx.getWebSockets();
    for (const socket of sockets) {
        try {
            socket.send(payload);
        } catch (e) {
            console.error("Failed to broadcast to socket", e);
        }
    }
  }

  // --- WebSocket Handlers ---
  
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // We don't strictly need to handle client -> server WebSocket messages here,
    // since the frontend calls REST APIs (/api/spotify/play) which then call `broadcast()`.
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.sessions.delete(ws);
  }

  webSocketError(ws: WebSocket, error: unknown) {
    this.sessions.delete(ws);
  }
}
