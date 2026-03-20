import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { SpotifyControlService } from "@/backend/services/spotify";
import { getSecret } from "@/backend/utils/secrets";
import { Logger } from "@/logging";

export const spotifyRoutes = new OpenAPIHono<{ Bindings: Env }>();

const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-library-read",
  "user-library-modify",
  "user-read-recently-played",
  "playlist-read-collaborative",
  "playlist-read-private",
  "streaming",
].join(" ");

const REDIRECT_URI = (env: Env) =>
  `https://dopamine.hacolby.workers.dev/api/spotify/redirect`;

/** Helper: get the singleton SpotifyOAuthStore DO stub. */
function getTokenDO(env: Env) {
  const id = (env as any).SPOTIFY_OAUTH_STORE.idFromName("singleton");
  return (env as any).SPOTIFY_OAUTH_STORE.get(id) as any;
}

async function getSpotifyService(env: Env) {
  const clientId = await getSecret(env, "SPOTIFY_CLIENT_ID") || "";
  const clientSecret = await getSecret(env, "SPOTIFY_CLIENT_SECRET") || "";
  return new SpotifyControlService({ clientId, clientSecret }, env);
}

function getSyncHubDO(env: Env) {
  const id = (env as any).SPOTIFY_SYNC_HUB.idFromName("singleton");
  return (env as any).SPOTIFY_SYNC_HUB.get(id) as any;
}

const ErrorSchema = z.object({ error: z.string() });

// ─── GET /login ───────────────────────────────────────────────────────────────
spotifyRoutes.get("/login", async (c) => {
  const clientId = await getSecret(c.env, "SPOTIFY_CLIENT_ID") || "";
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI(c.env),
    state,
  });
  // Important: ensure the redirect uri matches exactly what's registered in the Spotify Developer Dashboard.
  return c.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// ─── GET /redirect ────────────────────────────────────────────────────────────
spotifyRoutes.get("/redirect", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error || !code) {
    return c.html(`<h2>Spotify Authorization Failed</h2><p>${error ?? "No code returned"}</p>`, 400);
  }

  const clientId = await getSecret(c.env, "SPOTIFY_CLIENT_ID") || "";
  const clientSecret = await getSecret(c.env, "SPOTIFY_CLIENT_SECRET") || "";
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI(c.env),
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    await Logger.error("Spotify OAuth callback failed", c.env, { module: "spotify", event: "oauth_callback_error", request: c.req.raw, data: { err } });
    return c.html(`<h2>Token Exchange Failed</h2><pre>${err}</pre>`, 500);
  }

  const data = await tokenRes.json() as { access_token: string; refresh_token: string; expires_in: number };

  const do_ = getTokenDO(c.env);
  await do_.saveTokens(data.access_token, data.refresh_token, data.expires_in);

  await Logger.info("Spotify OAuth connected", c.env, { module: "spotify", event: "oauth_success", request: c.req.raw });

  return c.html(`
    <!DOCTYPE html>
    <html><head><title>Spotify Connected</title><style>
      body { font-family: system-ui; background: #09090b; color: #fafafa; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .card { background: #111; border: 1px solid #1DB954; border-radius: 16px; padding: 2rem; text-align: center; max-width: 400px; }
      h2 { color: #1DB954; }
      a { color: #60a5fa; }
    </style></head>
    <body><div class="card">
      <h2>✅ Spotify Connected!</h2>
      <p>Your Dopamine app is now authorized to control Spotify.</p>
      <p><a href="/">← Return to Dashboard</a></p>
    </div></body></html>
  `);
});

// ─── GET /status ──────────────────────────────────────────────────────────────
spotifyRoutes.get("/status", async (c) => {
  try {
    const do_ = getTokenDO(c.env);
    const hasTokens = await do_.hasTokens();
    return c.json({ connected: hasTokens, loginUrl: "/api/spotify/login" }, 200);
  } catch (e: any) {
    return c.json({ connected: false, error: e.message }, 200);
  }
});

// ─── GET /logout ─────────────────────────────────────────────────────────────
spotifyRoutes.delete("/logout", async (c) => {
  const do_ = getTokenDO(c.env);
  await do_.clearTokens();
  return c.json({ success: true }, 200);
});

// ─── GET /playback ────────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "get",
    path: "/playback",
    responses: {
      200: { description: "Current playback state", content: { "application/json": { schema: z.any() } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      const spotify = await getSpotifyService(c.env);
      const state = await spotify.getPlaybackState();
      return c.json(state || { is_playing: false }, 200);
    } catch (e: any) {
      await Logger.error("Failed to fetch Spotify playback state", c.env, { module: "spotify", event: "get_playback_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── GET /ws/sync ─────────────────────────────────────────────────────────────
spotifyRoutes.get("/ws/sync", async (c) => {
  const hub = getSyncHubDO(c.env);
  return hub.fetch(c.req.raw);
});

// ─── GET /devices ─────────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "get",
    path: "/devices",
    responses: {
      200: { description: "List of all available Spotify devices", content: { "application/json": { schema: z.any() } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      const spotify = await getSpotifyService(c.env);
      const devices = await spotify.getDevices();
      await Logger.info("Fetched Spotify devices", c.env, {
        module: "spotify",
        event: "get_devices",
        request: c.req.raw,
        data: { count: devices.length, deviceNames: devices.map(d => d.name) }
      });
      return c.json({ devices }, 200);
    } catch (e: any) {
      await Logger.error("Failed to fetch Spotify devices", c.env, { module: "spotify", event: "get_devices_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── PUT /play ────────────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "put",
    path: "/play",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              device_id: z.string().optional(),
              context_uri: z.string().optional(),
              uris: z.array(z.string()).optional()
            }).optional()
          }
        }
      }
    },
    responses: {
      200: { description: "Playback started", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      const body = c.req.valid("json") || {};
      await Logger.info("Play command triggered", c.env, { module: "spotify", event: "play", request: c.req.raw, data: body });
      const spotify = await getSpotifyService(c.env);
      await spotify.play(body);
      
      const hub = getSyncHubDO(c.env);
      await hub.broadcast({ is_playing: true, _action: "play" });

      return c.json({ success: true }, 200);
    } catch (e: any) {
      await Logger.error("Failed to start playback", c.env, { module: "spotify", event: "play_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── PUT /pause ───────────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "put",
    path: "/pause",
    responses: {
      200: { description: "Playback paused", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      await Logger.info("Pause command triggered", c.env, { module: "spotify", event: "pause", request: c.req.raw });
      const spotify = await getSpotifyService(c.env);
      await spotify.pause();
      
      const hub = getSyncHubDO(c.env);
      await hub.broadcast({ is_playing: false, _action: "pause" });
      
      return c.json({ success: true }, 200);
    } catch (e: any) {
      await Logger.error("Failed to pause playback", c.env, { module: "spotify", event: "pause_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── POST /next ───────────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "post",
    path: "/next",
    responses: {
      200: { description: "Skipped to next", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      await Logger.info("Skip next command triggered", c.env, { module: "spotify", event: "next", request: c.req.raw });
      const spotify = await getSpotifyService(c.env);
      await spotify.next();
      
      const hub = getSyncHubDO(c.env);
      await hub.broadcast({ is_playing: true, _action: "next" });
      
      return c.json({ success: true }, 200);
    } catch (e: any) {
      await Logger.error("Failed to skip to next track", c.env, { module: "spotify", event: "next_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── POST /previous ───────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "post",
    path: "/previous",
    responses: {
      200: { description: "Skipped to previous", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      await Logger.info("Skip previous command triggered", c.env, { module: "spotify", event: "previous", request: c.req.raw });
      const spotify = await getSpotifyService(c.env);
      await spotify.previous();

      const hub = getSyncHubDO(c.env);
      await hub.broadcast({ is_playing: true, _action: "previous" });
      
      return c.json({ success: true }, 200);
    } catch (e: any) {
      await Logger.error("Failed to skip to previous track", c.env, { module: "spotify", event: "previous_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── PUT /transfer ────────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "put",
    path: "/transfer",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ device_id: z.string() })
          }
        }
      }
    },
    responses: {
      200: { description: "Playback transferred", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      const { device_id } = c.req.valid("json");
      await Logger.info("Transfer playback command triggered", c.env, { module: "spotify", event: "transfer", request: c.req.raw, data: { device_id } });
      const spotify = await getSpotifyService(c.env);
      await spotify.transfer(device_id);
      return c.json({ success: true }, 200);
    } catch (e: any) {
      await Logger.error("Failed to transfer playback", c.env, { module: "spotify", event: "transfer_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── PUT /volume ──────────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "put",
    path: "/volume",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              volume_percent: z.number().min(0).max(100),
              device_id: z.string().optional()
            })
          }
        }
      }
    },
    responses: {
      200: { description: "Volume updated", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      const { volume_percent, device_id } = c.req.valid("json");
      await Logger.info("Volume command triggered", c.env, { module: "spotify", event: "volume", request: c.req.raw, data: { volume_percent, device_id } });
      const spotify = await getSpotifyService(c.env);
      await spotify.setVolume(volume_percent, device_id || undefined);
      
      const hub = getSyncHubDO(c.env);
      await hub.broadcast({ _action: "volume", volume_percent });
      
      return c.json({ success: true }, 200);
    } catch (e: any) {
      await Logger.error("Failed to set volume", c.env, { module: "spotify", event: "volume_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── PUT /likes ───────────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "put",
    path: "/likes",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ track_id: z.string() })
          }
        }
      }
    },
    responses: {
      200: { description: "Track liked", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      const { track_id } = c.req.valid("json");
      const spotify = await getSpotifyService(c.env);
      await spotify.saveTrack(track_id);
      await Logger.info("Track liked", c.env, { module: "spotify", event: "like_track", request: c.req.raw, data: { track_id } });
      return c.json({ success: true }, 200);
    } catch (e: any) {
      await Logger.error("Failed to like track", c.env, { module: "spotify", event: "like_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── DELETE /likes ────────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/likes",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ track_id: z.string() })
          }
        }
      }
    },
    responses: {
      200: { description: "Track unliked", content: { "application/json": { schema: z.object({ success: z.boolean() }) } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      const { track_id } = c.req.valid("json");
      const spotify = await getSpotifyService(c.env);
      await spotify.removeTrack(track_id);
      await Logger.info("Track unliked", c.env, { module: "spotify", event: "unlike_track", request: c.req.raw, data: { track_id } });
      return c.json({ success: true }, 200);
    } catch (e: any) {
      await Logger.error("Failed to unlike track", c.env, { module: "spotify", event: "unlike_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── POST /likes/check ────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "post",
    path: "/likes/check",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ track_ids: z.array(z.string()) })
          }
        }
      }
    },
    responses: {
      200: { description: "Check if tracks are liked", content: { "application/json": { schema: z.object({ likes: z.array(z.boolean()) }) } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    try {
      const { track_ids } = c.req.valid("json");
      const spotify = await getSpotifyService(c.env);
      const likes = await spotify.checkSavedTracks(track_ids);
      return c.json({ likes }, 200);
    } catch (e: any) {
      await Logger.error("Failed to check saved tracks", c.env, { module: "spotify", event: "likes_check_error", request: c.req.raw, error: e });
      return c.json({ error: e.message }, 500);
    }
  }
);

// ─── POST /dj ─────────────────────────────────────────────────────────────────
spotifyRoutes.openapi(
  createRoute({
    method: "post",
    path: "/dj",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ prompt: z.string() })
          }
        }
      }
    },
    responses: {
      200: { description: "DJ Playlist generated and started", content: { "application/json": { schema: z.any() } } },
      500: { description: "Server Error", content: { "application/json": { schema: ErrorSchema } } }
    }
  }),
  async (c) => {
    const { prompt } = c.req.valid("json");
    await Logger.info("DJ playlist requested", c.env, {
      module: "spotify",
      event: "dj_start",
      request: c.req.raw,
      data: { prompt }
    });
    try {
      const spotify = await getSpotifyService(c.env);
      const result = await spotify.djPlaylist(prompt);
      await Logger.info("DJ playlist completed", c.env, {
        module: "spotify",
        event: "dj_complete",
        request: c.req.raw,
        data: { success: result.success, tracksQueued: result.uris?.length, message: result.message }
      });
      
      const hub = getSyncHubDO(c.env);
      await hub.broadcast({ is_playing: true, _action: "play", _dj: true });

      return c.json(result, 200);
    } catch (e: any) {
      await Logger.error("DJ playlist failed", c.env, {
        module: "spotify",
        event: "dj_error",
        request: c.req.raw,
        error: e,
        data: { prompt }
      });
      return c.json({ error: e.message }, 500);
    }
  }
);