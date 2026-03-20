import type { CodeHealthCheck } from "../registry";

/**
 * Hardware & WebSocket connectivity health checks.
 * Tests VPC binding, VPC HTTP reachability, PrinterHub DO, and
 * WebSocket handshake latency to the Raspberry Pi bridge.
 */
export const PRINTER_CHECKS: CodeHealthCheck[] = [
  {
    id: "printer_vpc_binding",
    name: "Printer VPC Binding",
    group: "Hardware & WebSocket",
    check: async (env: Env) => {
      if (!env.PRINTER_VPC) return { ok: false, message: "PRINTER_VPC service binding missing." };
      return { ok: true, message: "PRINTER_VPC binding present." };
    },
  },
  {
    id: "printer_vpc_http",
    name: "Raspberry Pi VPC HTTP Ping",
    group: "Hardware & WebSocket",
    check: async (env: Env) => {
      try {
        if (!env.PRINTER_VPC) return { ok: false, message: "PRINTER_VPC binding missing." };
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await env.PRINTER_VPC.fetch("http://127.0.0.1:8080/health", {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return { ok: false, message: `Pi HTTP returned ${res.status}.` };
        return { ok: true, message: `Pi HTTP OK (${res.status}).` };
      } catch (e: any) {
        return { ok: e.name === "AbortError"
          ? false
          : false, message: e.name === "AbortError" ? "Pi VPC HTTP timed out (6s)." : `VPC error: ${e.message}` };
      }
    },
  },
  {
    id: "printer_hub_do_reachable",
    name: "PrinterHub Durable Object",
    group: "Hardware & WebSocket",
    check: async (env: Env) => {
      try {
        if (!env.PRINTER_HUB) return { ok: false, message: "PRINTER_HUB binding missing." };
        const id = env.PRINTER_HUB.idFromName("global-printer-hub");
        const stub = env.PRINTER_HUB.get(id);
        // Simple HTTP broadcast to DO's internal /broadcast endpoint
        const res = await stub.fetch(new Request("http://internal/broadcast", {
          method: "POST",
          body: JSON.stringify({ type: "health_probe" }),
        }));
        return { ok: res.ok, message: res.ok ? "PrinterHub DO responded OK." : `DO returned ${res.status}.` };
      } catch (e: any) {
        return { ok: false, message: `PrinterHub DO error: ${e.message}` };
      }
    },
  },
  {
    id: "websocket_handshake",
    name: "WebSocket Handshake (PrinterHub)",
    group: "Hardware & WebSocket",
    check: async (env: Env) => {
      // Test the WebSocket endpoint via HTTP upgrade through the DO.
      // We can't open a real WS from inside a Worker, so we verify that the
      // /api/printer/ws endpoint responds correctly to a WebSocket upgrade request.
      try {
        if (!env.PRINTER_HUB) return { ok: false, message: "PRINTER_HUB binding missing." };
        const id = env.PRINTER_HUB.idFromName("global-printer-hub");
        const stub = env.PRINTER_HUB.get(id);
        // Send an upgrade request — the DO should return 101 or reject gracefully
        const upgradeReq = new Request("http://internal/ws?client=health", {
          headers: { Upgrade: "websocket", Connection: "Upgrade" },
        });
        const res = await stub.fetch(upgradeReq);
        // 101 Switching Protocols or 426 (correct behavior) both prove the DO is handling WS
        const ok = res.status === 101 || res.status === 426 || res.status === 200;
        return { ok, message: ok
          ? `WS endpoint responsive (${res.status}).`
          : `Unexpected WS response: ${res.status}.` };
      } catch (e: any) {
        return { ok: false, message: `WS probe error: ${e.message}` };
      }
    },
  },
  {
    id: "pi_reconnect_status",
    name: "Raspberry Pi Reconnect Telemetry",
    group: "Hardware & WebSocket",
    check: async (env: Env) => {
      // Check KV for last known Pi telemetry timestamp to detect prolonged disconnection
      try {
        const lastSeen = await env.KV.get("pi:last_telemetry_ts");
        if (!lastSeen) return { ok: false, message: "No Pi telemetry recorded yet." };
        const ageMs = Date.now() - Number(lastSeen);
        const ageMins = Math.floor(ageMs / 60000);
        const ok = ageMs < 10 * 60 * 1000; // fail if silent > 10 min
        return { ok, message: ok
          ? `Pi sent telemetry ${ageMins}m ago.`
          : `Pi has been silent for ${ageMins}m (threshold: 10m).` };
      } catch (e: any) {
        return { ok: false, message: `KV read error: ${e.message}` };
      }
    },
  },
];
