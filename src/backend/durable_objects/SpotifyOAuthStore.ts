import { DurableObject } from "cloudflare:workers";

/**
 * SpotifyOAuthStore — Durable Object for persistent OAuth token storage.
 *
 * Stores Spotify access + refresh tokens in DO SQLite storage so they
 * survive across all Worker invocations without relying on KV consistency.
 * Exposes RPC methods used by SpotifyControlService.
 */
export class SpotifyOAuthStore extends DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async fetch(request: Request): Promise<Response> {
    return new Response("SpotifyOAuthStore DO — use RPC methods", { status: 200 });
  }

  /** Save tokens from OAuth callback. */
  async saveTokens(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    await this.ctx.storage.put("access_token", accessToken);
    await this.ctx.storage.put("refresh_token", refreshToken);
    await this.ctx.storage.put("expires_at", Date.now() + (expiresIn - 60) * 1000);
  }

  /** Clear all stored tokens (logout). */
  async clearTokens(): Promise<void> {
    await this.ctx.storage.delete("access_token");
    await this.ctx.storage.delete("refresh_token");
    await this.ctx.storage.delete("expires_at");
  }

  /** Returns true if a refresh token is stored (login completed). */
  async hasTokens(): Promise<boolean> {
    const rt = await this.ctx.storage.get<string>("refresh_token");
    return !!rt;
  }

  /**
   * Returns a valid access token, automatically refreshing if expired.
   * Throws if no refresh token is stored (user hasn't connected Spotify).
   */
  async getValidToken(clientId: string, clientSecret: string): Promise<string> {
    const expiresAt = (await this.ctx.storage.get<number>("expires_at")) ?? 0;
    const accessToken = await this.ctx.storage.get<string>("access_token");

    // Return cached token if still fresh
    if (accessToken && Date.now() < expiresAt) {
      return accessToken;
    }

    // Need to refresh
    const refreshToken = await this.ctx.storage.get<string>("refresh_token");
    if (!refreshToken) {
      throw new Error("Spotify not connected. Visit /api/spotify/login to authorize.");
    }

    return this._doRefresh(clientId, clientSecret, refreshToken);
  }

  private async _doRefresh(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Spotify token refresh failed (${res.status}): ${err}`);
    }

    const data = await res.json() as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    // Persist the refreshed tokens
    await this.ctx.storage.put("access_token", data.access_token);
    await this.ctx.storage.put("expires_at", Date.now() + (data.expires_in - 60) * 1000);

    // Spotify may rotate the refresh token
    if (data.refresh_token) {
      await this.ctx.storage.put("refresh_token", data.refresh_token);
    }

    return data.access_token;
  }
}
