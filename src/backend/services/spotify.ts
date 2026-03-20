import { z } from "zod";
import { generateStructuredResponse } from "@/backend/ai/providers/index";

export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
}

export interface SpotifyDevice {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number;
}

/** Get the singleton SpotifyOAuthStore DO stub. */
function getTokenDO(env: Env) {
  const id = (env as any).SPOTIFY_OAUTH_STORE.idFromName("singleton");
  return (env as any).SPOTIFY_OAUTH_STORE.get(id) as any;
}

export class SpotifyControlService {
  private config: SpotifyConfig;
  private env: Env;

  constructor(config: SpotifyConfig, env: Env) {
    this.config = config;
    this.env = env;
  }

  /**
   * Self-healing fetch wrapper for the Spotify API.
   * Delegates token management to SpotifyOAuthStore DO.
   */
  private async fetchSpotify(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const do_ = getTokenDO(this.env);
    const token = await do_.getValidToken(this.config.clientId, this.config.clientSecret);
    const url = endpoint.startsWith("http") ? endpoint : `https://api.spotify.com/v1${endpoint}`;

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Content-Type", "application/json");

    const response = await fetch(url, { ...options, headers });

    // 401: force token refresh once and retry
    if (response.status === 401) {
      const freshToken = await do_.getValidToken(this.config.clientId, this.config.clientSecret);
      headers.set("Authorization", `Bearer ${freshToken}`);
      return fetch(url, { ...options, headers });
    }

    return response;
  }

  /**
   * Translates a natural language prompt into a tailored playlist via structured AI output, 
   * searches Spotify for the exact track URIs, and triggers playback.
   */
  public async djPlaylist(prompt: string): Promise<{ success: boolean; message: string; uris: string[] }> {
    const PlaylistSchema = {
      type: "object",
      properties: {
        searchQueries: {
          type: "array",
          items: { type: "string" },
          description: "A list of exactly 10 specific song search queries formatted as 'track:Track Name artist:Artist Name'."
        }
      },
      required: ["searchQueries"],
      additionalProperties: false
    };

    const object = await generateStructuredResponse<{ searchQueries: string[] }>(
      this.env,
      prompt,
      PlaylistSchema,
      "You are an expert DJ. The user will give you a vibe, genre, or mood. Generate exactly 10 specific song search queries that fit the prompt perfectly."
    );

    const uris: string[] = [];
    
    for (const query of object.searchQueries) {
      const tracks = await this.searchTracks(query, 1);
      if (tracks.length > 0 && tracks[0].uri) {
        uris.push(tracks[0].uri);
      }
    }

    if (uris.length === 0) {
      return { success: false, message: "Could not find any matching tracks on Spotify.", uris: [] };
    }

    try {
      await this.play({ uris });
      return { success: true, message: `Successfully queued and started ${uris.length} tracks.`, uris };
    } catch (e: any) {
      return { success: false, message: `Failed to start playback on devices: ${e.message}`, uris };
    }
  }

  /**
   * Maps a natural language speaker request (e.g., "Living Room") to an active Spotify device
   * using typed LLM schema extraction, and transfers playback dynamically.
   */
  public async controlSpeaker(speakerPrompt: string): Promise<{ success: boolean; message: string }> {
    const devices = await this.getDevices();

    if (devices.length === 0) {
      return { success: false, message: "No active Spotify devices found on your account." };
    }

    const DeviceMatchSchema = {
      type: "object",
      properties: {
        matchedId: {
          type: "string",
          description: "The exact string `id` of the best matching Spotify device from the provided JSON, or 'NO_MATCH' if none match reasonably well."
        }
      },
      required: ["matchedId"],
      additionalProperties: false
    };

    const object = await generateStructuredResponse<{ matchedId: string }>(
      this.env,
      `Devices: ${JSON.stringify(devices)}\n\nUser Request: ${speakerPrompt}`,
      DeviceMatchSchema,
      "You are a smart home assistant routing audio. Given a list of available Spotify devices (JSON) and a user's target speaker prompt, identify the correct device ID."
    );

    const matchedId = object.matchedId;

    if (!matchedId || matchedId === "NO_MATCH") {
      const availableNames = devices.map(d => d.name).join(", ");
      return { success: false, message: `Could not match "${speakerPrompt}" to an available device. Available devices: ${availableNames}` };
    }

    try {
      await this.transfer(matchedId);
      return { success: true, message: `Playback successfully transferred to device ID: ${matchedId}` };
    } catch (e: any) {
      return { success: false, message: `Failed to transfer playback: ${e.message}` };
    }
  }

  // --- Granular Primitives for MCP and Autonomy ---

  public async searchTracks(query: string, limit: number = 10): Promise<any[]> {
    const searchParams = new URLSearchParams({
      q: query,
      type: "track",
      limit: limit.toString()
    });
    const res = await this.fetchSpotify(`/search?${searchParams.toString()}`);
    if (!res.ok) throw new Error(`Failed to search tracks: ${await res.text()}`);
    const data = await res.json() as any;
    return data.tracks?.items?.map((t: any) => ({
      uri: t.uri,
      id: t.id,
      name: t.name,
      artists: t.artists.map((a: any) => a.name).join(', '),
      duration_ms: t.duration_ms
    })) || [];
  }

  public async createPlaylist(name: string, description?: string): Promise<any> {
    const meRes = await this.fetchSpotify('/me');
    if (!meRes.ok) throw new Error(`Failed to fetch user profile: ${await meRes.text()}`);
    const meData = await meRes.json() as any;
    
    const res = await this.fetchSpotify(`/users/${meData.id}/playlists`, {
      method: 'POST',
      body: JSON.stringify({ name, description, public: false })
    });
    if (!res.ok) throw new Error(`Failed to create playlist: ${await res.text()}`);
    return await res.json();
  }

  public async addTracksToPlaylist(playlistId: string, uris: string[], replace: boolean = false): Promise<void> {
    const method = replace ? 'PUT' : 'POST';
    const res = await this.fetchSpotify(`/playlists/${playlistId}/tracks`, {
      method,
      body: JSON.stringify({ uris })
    });
    if (!res.ok) throw new Error(`Failed to update playlist: ${await res.text()}`);
  }

  public async getDevices(): Promise<SpotifyDevice[]> {
    const res = await this.fetchSpotify("/me/player/devices");
    if (!res.ok) throw new Error(`Failed to fetch devices: ${await res.text()}`);
    const data = await res.json() as { devices: SpotifyDevice[] };
    return data.devices;
  }

  public async getPlaybackState(): Promise<any> {
    const res = await this.fetchSpotify("/me/player");
    if (res.status === 204) return null; // Nothing currently playing
    if (!res.ok) throw new Error(`Failed to fetch playback state: ${await res.text()}`);
    return await res.json();
  }

  public async play(options?: { device_id?: string; context_uri?: string; uris?: string[] }): Promise<void> {
    let url = "/me/player/play";
    if (options?.device_id) {
      url += `?device_id=${options.device_id}`;
    }
    
    const body: any = {};
    if (options?.context_uri) {
      body.context_uri = options.context_uri;
    } else if (options?.uris && options.uris.length > 0) {
      body.uris = options.uris;
    }

    const res = await this.fetchSpotify(url, { 
      method: "PUT",
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
    });
    if (!res.ok && res.status !== 204) throw new Error(`Failed to play: ${await res.text()}`);
  }

  public async pause(): Promise<void> {
    const res = await this.fetchSpotify("/me/player/pause", { method: "PUT" });
    if (!res.ok && res.status !== 204) throw new Error(`Failed to pause playback: ${await res.text()}`);
  }

  public async next(): Promise<void> {
    const res = await this.fetchSpotify("/me/player/next", { method: "POST" });
    if (!res.ok && res.status !== 204) throw new Error(`Failed to skip track: ${await res.text()}`);
  }

  public async previous(): Promise<void> {
    const res = await this.fetchSpotify("/me/player/previous", { method: "POST" });
    if (!res.ok && res.status !== 204) throw new Error(`Failed to skip to previous: ${await res.text()}`);
  }

  public async transfer(deviceId: string): Promise<void> {
    const res = await this.fetchSpotify("/me/player", {
      method: "PUT",
      body: JSON.stringify({ device_ids: [deviceId], play: true })
    });
    if (!res.ok && res.status !== 204) throw new Error(`Failed to transfer playback: ${await res.text()}`);
  }

  public async setVolume(volumePercent: number, deviceId?: string): Promise<void> {
    const params = new URLSearchParams({ volume_percent: volumePercent.toString() });
    if (deviceId) params.append("device_id", deviceId);
    
    const res = await this.fetchSpotify(`/me/player/volume?${params.toString()}`, { method: "PUT" });
    if (!res.ok && res.status !== 204) throw new Error(`Failed to set volume: ${await res.text()}`);
  }

  public async saveTrack(trackId: string): Promise<void> {
    const params = new URLSearchParams({ ids: trackId });
    const res = await this.fetchSpotify(`/me/tracks?${params.toString()}`, { method: "PUT" });
    if (!res.ok && res.status !== 200 && res.status !== 204) throw new Error(`Failed to save track: ${await res.text()}`);
  }

  public async removeTrack(trackId: string): Promise<void> {
    const params = new URLSearchParams({ ids: trackId });
    const res = await this.fetchSpotify(`/me/tracks?${params.toString()}`, { method: "DELETE" });
    if (!res.ok && res.status !== 200 && res.status !== 204) throw new Error(`Failed to remove track: ${await res.text()}`);
  }

  public async checkSavedTracks(trackIds: string[]): Promise<boolean[]> {
    if (trackIds.length === 0) return [];
    const params = new URLSearchParams({ ids: trackIds.join(",") });
    const res = await this.fetchSpotify(`/me/tracks/contains?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to check saved tracks: ${await res.text()}`);
    return await res.json();
  }
}