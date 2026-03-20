import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SpotifyControlService } from "@/backend/services/spotify";
import { getSecret } from "@/backend/utils/secrets";

/**
 * Creates and configures the Spotify MCP Server.
 * Exposes the SpotifyControlService methods natively as standard MCP tools.
 */
export function createSpotifyMcpServer(env: Env): McpServer {
  const server = new McpServer({
    name: "SpotifyMCP",
    version: "1.0.0",
  });

  // Internal helper to instantiate the service dynamically per tool invocation
  async function getSpotify() {
    const clientId = await getSecret(env, "SPOTIFY_CLIENT_ID") || "";
    const clientSecret = await getSecret(env, "SPOTIFY_CLIENT_SECRET") || "";
    return new SpotifyControlService({ clientId, clientSecret }, env);
  }

  // --- 1. Macro Smart Tools ---

  server.tool(
    "djPlaylist",
    "Generates and plays a tailored Spotify playlist based on a vibe or genre prompt.",
    { prompt: z.string().describe("The vibe, genre, or mood for the playlist.") },
    async ({ prompt }) => {
      const spotify = await getSpotify();
      const result = await spotify.djPlaylist(prompt);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "controlSpeaker",
    "Transfers playback dynamically to a specific Spotify device based on a natural language prompt.",
    { speakerPrompt: z.string().describe("Target speaker name or location (e.g., 'Living Room').") },
    async ({ speakerPrompt }) => {
      const spotify = await getSpotify();
      const result = await spotify.controlSpeaker(speakerPrompt);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // --- 2. Granular Autonomous Tools ---

  server.tool(
    "search_music",
    "Search for tracks using natural language, mood, genre, or specific artist profiles.",
    {
      query: z.string().describe("The search query"),
      limit: z.number().min(1).max(50).default(10).describe("Number of tracks to return")
    },
    async ({ query, limit }) => {
      const spotify = await getSpotify();
      const tracks = await spotify.searchTracks(query, limit);
      return { content: [{ type: "text", text: JSON.stringify(tracks, null, 2) }] };
    }
  );

  server.tool(
    "create_playlist",
    "Create a new playlist for the authenticated user.",
    { 
      name: z.string().describe("The name of the playlist"),
      description: z.string().optional().describe("Description of the playlist")
    },
    async ({ name, description }) => {
      const spotify = await getSpotify();
      const data = await spotify.createPlaylist(name, description);
      return { content: [{ type: "text", text: JSON.stringify({ id: data.id, uri: data.uri }) }] };
    }
  );

  server.tool(
    "manage_playlist_tracks",
    "Add an array of track URIs to a specific playlist.",
    {
      playlist_id: z.string().describe("The Spotify ID of the target playlist"),
      uris: z.array(z.string()).describe("Array of Spotify track URIs"),
      replace: z.boolean().default(false).describe("If true, replaces all tracks instead of appending")
    },
    async ({ playlist_id, uris, replace }) => {
      const spotify = await getSpotify();
      await spotify.addTracksToPlaylist(playlist_id, uris, replace);
      return { content: [{ type: "text", text: `Successfully updated playlist ${playlist_id} with ${uris.length} tracks.` }] };
    }
  );

  server.tool(
    "get_devices",
    "Get a list of currently active or available Spotify playback devices.",
    {},
    async () => {
      const spotify = await getSpotify();
      const devices = await spotify.getDevices();
      return { content: [{ type: "text", text: JSON.stringify(devices, null, 2) }] };
    }
  );

  server.tool(
    "control_player",
    "Control playback state (play, pause, next, previous, transfer) and optionally target a specific device.",
    {
      action: z.enum(['play', 'pause', 'next', 'previous', 'transfer']).describe("The playback action to execute"),
      device_id: z.string().optional().describe("ID of the device to target or transfer to"),
      uris: z.array(z.string()).optional().describe("Optional array of track URIs to start playing"),
      context_uri: z.string().optional().describe("Optional playlist or album URI to play")
    },
    async ({ action, device_id, uris, context_uri }) => {
      const spotify = await getSpotify();
      
      try {
        switch (action) {
          case 'transfer':
            if (!device_id) return { content: [{ type: "text", text: "Error: device_id is required for transfer" }] };
            await spotify.transfer(device_id);
            break;
          case 'play':
            await spotify.play({ device_id, uris, context_uri });
            break;
          case 'pause':
            await spotify.pause();
            break;
          case 'next':
            await spotify.next();
            break;
          case 'previous':
            await spotify.previous();
            break;
        }
        return { content: [{ type: "text", text: `Player action '${action}' executed successfully.` }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Failed to execute ${action}: ${e.message}` }] };
      }
    }
  );

  return server;
}