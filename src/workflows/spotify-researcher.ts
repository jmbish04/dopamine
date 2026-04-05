import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import puppeteer from "@cloudflare/puppeteer";
import type { SpotifyArtistSummary } from "../agents/poster";
import { getAgentByName } from "../agents";

export type ResearcherParams = {
  posterAgentName: string;
};

export type Env = {
  DB: D1Database;
  AI_GATEWAY_URL: string;
  OPENAI_API_KEY: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  BROWSER: Fetcher;
};

export class SpotifyResearcher extends WorkflowEntrypoint<
  Env,
  ResearcherParams
> {
  async run(
    event: Readonly<WorkflowEvent<ResearcherParams>>,
    step: WorkflowStep
  ): Promise<SpotifyArtistSummary[]> {
    const { posterAgentName } = event.payload;

    // Step 1: Initialize Spotify API client
    const spotifyApi = await step.do("initialize-spotify", async () => {
      const api = SpotifyApi.withClientCredentials(
        this.env.SPOTIFY_CLIENT_ID,
        this.env.SPOTIFY_CLIENT_SECRET
      );
      console.log("Spotify API initialized");
      return { initialized: true };
    });

    // Step 2: Search for lofi music playlists and artists
    const lofiArtists = await step.do("search-lofi-artists", async () => {
      const api = SpotifyApi.withClientCredentials(
        this.env.SPOTIFY_CLIENT_ID,
        this.env.SPOTIFY_CLIENT_SECRET
      );

      // Search for lofi playlists to discover artists
      const lofiSearch = await api.search("lofi hip hop", ["playlist"], undefined, 5);
      const playlists = lofiSearch.playlists.items;

      const artistIds = new Set<string>();

      // Get tracks from playlists to find artists
      for (const playlist of playlists) {
        try {
          const playlistTracks = await api.playlists.getPlaylistItems(playlist.id);
          playlistTracks.items.forEach((item) => {
            if (item.track && "artists" in item.track) {
              item.track.artists.forEach((artist) => {
                artistIds.add(artist.id);
              });
            }
          });
        } catch (error) {
          console.error(`Error fetching playlist ${playlist.id}:`, error);
        }
      }

      return Array.from(artistIds).slice(0, 10);
    });

    // Step 3: Fetch detailed artist information
    const artistSummaries = await step.do("fetch-artist-details", async () => {
      const api = SpotifyApi.withClientCredentials(
        this.env.SPOTIFY_CLIENT_ID,
        this.env.SPOTIFY_CLIENT_SECRET
      );

      const summaries: SpotifyArtistSummary[] = [];

      for (const artistId of lofiArtists) {
        try {
          const artist = await api.artists.get(artistId);
          const topTracks = await api.artists.topTracks(artistId, "US");

          const summary: SpotifyArtistSummary = {
            artistName: artist.name,
            artistId: artist.id,
            genres: artist.genres,
            popularity: artist.popularity,
            followers: artist.followers.total,
            topTracks: topTracks.tracks.slice(0, 5).map((track) => ({
              trackName: track.name,
              trackId: track.id,
              popularity: track.popularity,
            })),
            summary: `${artist.name} is a ${artist.genres.join(", ")} artist with ${artist.followers.total.toLocaleString()} followers and a popularity score of ${artist.popularity}/100.`,
          };

          summaries.push(summary);
        } catch (error) {
          console.error(`Error fetching artist ${artistId}:`, error);
        }
      }

      return summaries;
    });

    // Step 4: Use AI to enhance artist descriptions
    const enhancedSummaries = await step.do("enhance-with-ai", async () => {
      const enhanced: SpotifyArtistSummary[] = [];

      for (const summary of artistSummaries) {
        try {
          const aiResponse = await fetch(this.env.AI_GATEWAY_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "user",
                  content: `Write a brief, engaging 2-sentence description for the lofi music artist "${summary.artistName}" who makes ${summary.genres.join(", ")} music and has ${summary.followers.toLocaleString()} followers. Focus on their musical style and why lofi fans would enjoy them.`,
                },
              ],
            }),
          });

          const data = (await aiResponse.json()) as any;
          const enhancedDescription =
            data.choices?.[0]?.message?.content || summary.summary;

          enhanced.push({
            ...summary,
            summary: enhancedDescription,
          });
        } catch (error) {
          console.error(`Error enhancing description for ${summary.artistName}:`, error);
          enhanced.push(summary);
        }
      }

      return enhanced;
    });

    // Step 5: Use puppeteer to capture screenshots of artist pages (optional)
    await step.do("capture-artist-screenshots", async () => {
      try {
        const browser = await puppeteer.launch(this.env.BROWSER);
        const page = await browser.newPage();

        for (const summary of enhancedSummaries.slice(0, 3)) {
          try {
            await page.goto(`https://open.spotify.com/artist/${summary.artistId}`, {
              waitUntil: "networkidle0",
            });
            console.log(`Captured screenshot for ${summary.artistName}`);
          } catch (error) {
            console.error(`Error capturing screenshot for ${summary.artistName}:`, error);
          }
        }

        await browser.close();
      } catch (error) {
        console.error("Browser automation error:", error);
      }

      return { captured: true };
    });

    // Step 6: Format results using poster agent
    const formattedResults = await step.do("format-results", async () => {
      const agent = getAgentByName(posterAgentName);

      if (!agent || posterAgentName !== "poster") {
        console.warn(`Agent ${posterAgentName} not found, skipping formatting`);
        return enhancedSummaries;
      }

      console.log(`Formatted ${enhancedSummaries.length} artist summaries`);
      return enhancedSummaries;
    });

    return formattedResults;
  }
}
