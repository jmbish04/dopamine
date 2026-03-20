import type { CodeHealthCheck } from "../registry";

/**
 * Spotify integration health checks.
 * Verifies required secrets are bound and optionally tests token exchange.
 */
export const SPOTIFY_CHECKS: CodeHealthCheck[] = [
  {
    id: "spotify_client_id",
    name: "Spotify Client ID Secret",
    group: "Spotify Integration",
    check: async (env: Env) => {
      const val = (env as any).SPOTIFY_CLIENT_ID;
      if (!val) return { ok: false, message: "SPOTIFY_CLIENT_ID not bound." };
      return { ok: true, message: "SPOTIFY_CLIENT_ID present." };
    },
  },
  {
    id: "spotify_client_secret",
    name: "Spotify Client Secret",
    group: "Spotify Integration",
    check: async (env: Env) => {
      const val = (env as any).SPOTIFY_CLIENT_SECRET;
      if (!val) return { ok: false, message: "SPOTIFY_CLIENT_SECRET not bound." };
      return { ok: true, message: "SPOTIFY_CLIENT_SECRET present." };
    },
  },
  {
    id: "spotify_token_exchange",
    name: "Spotify Token Exchange",
    group: "Spotify Integration",
    check: async (env: Env) => {
      try {
        const clientId = (env as any).SPOTIFY_CLIENT_ID;
        const clientSecret = (env as any).SPOTIFY_CLIENT_SECRET;
        if (!clientId || !clientSecret) return { ok: false, message: "Missing Spotify credentials." };
        const body = new URLSearchParams({ grant_type: "client_credentials" });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return { ok: false, message: `Token exchange failed (${res.status}).` };
        return { ok: true, message: "Spotify token exchange succeeded." };
      } catch (e: any) {
        return { ok: false, message: `Token exchange error: ${e.message}` };
      }
    },
  },
];
