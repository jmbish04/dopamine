import { createAgent, tool, z, type ToolDefinition } from "honidev";
import { SpotifyControlService } from "@/backend/services/spotify";
import { getSecret } from "@/backend/utils/secrets";

async function getSpotify(env: any) {
  const clientId = await getSecret(env, "SPOTIFY_CLIENT_ID") || "";
  const clientSecret = await getSecret(env, "SPOTIFY_CLIENT_SECRET") || "";
  return new SpotifyControlService({ clientId, clientSecret }, env);
}

const djPlaylistTool = tool({
  name: "djPlaylist",
  description: "Generates and plays a tailored Spotify playlist based on a vibe or genre prompt.",
  input: z.object({ prompt: z.string().describe("The vibe, genre, or mood for the playlist.") }) as any,
  handler: async ({ prompt }, ctx) => {
    const spotify = await getSpotify(ctx?.env);
    return await spotify.djPlaylist(prompt);
  },
});

const controlSpeakerTool = tool({
  name: "controlSpeaker",
  description: "Transfers playback dynamically to a specific Spotify device based on a natural language prompt.",
  input: z.object({ speakerPrompt: z.string().describe("Target speaker name or location (e.g., 'Living Room').") }) as any,
  handler: async ({ speakerPrompt }, ctx) => {
    const spotify = await getSpotify(ctx?.env);
    return await spotify.controlSpeaker(speakerPrompt);
  },
});

const searchMusicTool = tool({
  name: "search_music",
  description: "Search for tracks using natural language, mood, genre, or specific artist profiles.",
  input: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().min(1).max(50).default(10).describe("Number of tracks to return"),
  }),
  handler: async ({ query, limit }, ctx) => {
    const spotify = await getSpotify(ctx?.env);
    return await spotify.searchTracks(query, limit);
  },
});

const createPlaylistTool = tool({
  name: "create_playlist",
  description: "Create a new playlist for the authenticated user.",
  input: z.object({
    name: z.string().describe("The name of the playlist"),
    description: z.string().optional().describe("Description of the playlist"),
  }),
  handler: async ({ name, description }, ctx) => {
    const spotify = await getSpotify(ctx?.env);
    return await spotify.createPlaylist(name, description);
  },
});

const managePlaylistTracksTool = tool({
  name: "manage_playlist_tracks",
  description: "Add an array of track URIs to a specific playlist.",
  input: z.object({
    playlist_id: z.string().describe("The Spotify ID of the target playlist"),
    uris: z.array(z.string()).describe("Array of Spotify track URIs"),
    replace: z.boolean().default(false).describe("If true, replaces all tracks instead of appending"),
  }),
  handler: async ({ playlist_id, uris, replace }, ctx) => {
    const spotify = await getSpotify(ctx?.env);
    await spotify.addTracksToPlaylist(playlist_id, uris, replace);
    return { success: true, message: `Successfully updated playlist ${playlist_id}` };
  },
});

const getDevicesTool = tool({
  name: "get_devices",
  description: "Get a list of currently active or available Spotify playback devices.",
  input: z.object({}) as any,
  handler: async (_input, ctx) => {
    const spotify = await getSpotify(ctx?.env);
    return await spotify.getDevices();
  },
});

const controlPlayerTool = tool({
  name: "control_player",
  description: "Control playback state (play, pause, next, previous, transfer) and optionally target a specific device.",
  input: z.object({
    action: z.enum(["play", "pause", "next", "previous", "transfer"]).describe("The playback action to execute"),
    device_id: z.string().optional().describe("ID of the device to target or transfer to"),
    uris: z.array(z.string()).optional().describe("Optional array of track URIs to start playing"),
    context_uri: z.string().optional().describe("Optional playlist or album URI to play"),
  }),
  handler: async ({ action, device_id, uris, context_uri }, ctx) => {
    const spotify = await getSpotify(ctx?.env);
    try {
      switch (action) {
        case "transfer":
          if (!device_id) throw new Error("device_id is required for transfer");
          await spotify.transfer(device_id);
          break;
        case "play":
          await spotify.play({ device_id, uris, context_uri });
          break;
        case "pause":
          await spotify.pause();
          break;
        case "next":
          await spotify.next();
          break;
        case "previous":
          await spotify.previous();
          break;
      }
      return { success: true, action };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
});

export const { DurableObject: SpotifyAgentDO, fetch: spotifyHandler } = createAgent({
  name: "SpotifyAgent",
  model: "@cf/meta/llama-3.1-8b-instruct",
  system: `You are a smart home audio assistant. Given the user's prompt, invoke the appropriate Spotify tool. 
When setting up a playlist, use the djPlaylist tool. 
When asked to control or move playback to a specific speaker, use the controlSpeaker tool. 
If the user just wants you to play X on Y, do the playlist first, then run speaker control.`,
  binding: "SPOTIFY_AGENT",
  tools: [
    djPlaylistTool,
    controlSpeakerTool,
    searchMusicTool,
    createPlaylistTool,
    managePlaylistTracksTool,
    getDevicesTool,
    controlPlayerTool,
  ] as ToolDefinition[],
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
});

export class SpotifyAgent extends SpotifyAgentDO {}
export default spotifyHandler;