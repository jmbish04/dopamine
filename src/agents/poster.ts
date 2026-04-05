// Poster agent type definitions for Spotify artist summaries
export interface SpotifyArtistSummary {
  artistName: string;
  artistId: string;
  genres: string[];
  popularity: number;
  followers: number;
  topTracks: Array<{
    trackName: string;
    trackId: string;
    popularity: number;
  }>;
  summary: string;
}

export const posterAgent = {
  name: "poster",
  description: "Agent that formats and posts Spotify artist summaries",

  async formatArtistSummary(artist: SpotifyArtistSummary): Promise<string> {
    return `
🎵 **${artist.artistName}**
📊 Popularity: ${artist.popularity}/100
👥 Followers: ${artist.followers.toLocaleString()}
🎸 Genres: ${artist.genres.join(", ")}

Top Tracks:
${artist.topTracks.map((track, i) => `${i + 1}. ${track.trackName} (${track.popularity}/100)`).join("\n")}

${artist.summary}
    `.trim();
  }
};
