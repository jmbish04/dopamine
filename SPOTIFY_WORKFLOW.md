# Spotify Lofi Music Discovery Workflow

A Cloudflare Workflows implementation that improves lofi music discovery on Spotify.

## Overview

The `SpotifyResearcher` workflow automates the discovery and analysis of lofi music artists on Spotify. It uses the Spotify Web API, AI-powered enhancements, and optional browser automation to provide comprehensive artist insights.

## Features

- **Automated Discovery**: Searches Spotify for lofi hip hop playlists and extracts artist information
- **Detailed Analytics**: Fetches artist popularity, followers, genres, and top tracks
- **AI Enhancement**: Uses OpenAI via Cloudflare AI Gateway to generate engaging artist descriptions
- **Browser Automation**: Optional screenshot capture of artist pages using Puppeteer
- **Agent Integration**: Works with the poster agent for formatted output

## Workflow Steps

1. **Initialize Spotify API** - Authenticates with Spotify using client credentials
2. **Search Lofi Artists** - Finds lofi playlists and extracts up to 10 unique artists
3. **Fetch Artist Details** - Retrieves comprehensive information for each artist
4. **Enhance with AI** - Generates engaging descriptions using GPT-4o-mini
5. **Capture Screenshots** - Optionally captures artist page screenshots
6. **Format Results** - Uses the poster agent to format final output

## Environment Variables

The workflow requires the following environment variables:

- `SPOTIFY_CLIENT_ID` - Spotify API client ID
- `SPOTIFY_CLIENT_SECRET` - Spotify API client secret
- `AI_GATEWAY_URL` - Cloudflare AI Gateway URL
- `OPENAI_API_KEY` - OpenAI API key

## Usage

### Via API

Trigger the workflow via the REST API:

```bash
POST http://127.0.0.1:8787/api/spotify/research
Content-Type: application/json

{
  "posterAgentName": "poster"
}
```

Response:

```json
{
  "workflowId": "workflow-instance-id",
  "message": "Spotify lofi music discovery workflow started successfully"
}
```

### Via CLI

Use the local CLI to trigger the workflow:

```bash
npm run cli spotify-research
```

Or with a custom agent:

```bash
npm run cli spotify-research --agent poster
```

## Output Format

The workflow returns an array of `SpotifyArtistSummary` objects:

```typescript
interface SpotifyArtistSummary {
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
```

## Architecture

The workflow is built using:

- **Cloudflare Workers** - Serverless execution environment
- **Cloudflare Workflows** - Durable workflow orchestration
- **Spotify Web API SDK** - Official Spotify TypeScript SDK
- **Cloudflare Puppeteer** - Browser automation
- **OpenAI via AI Gateway** - AI-powered content enhancement

## Development

Build the project:

```bash
npm run build
```

Deploy to Cloudflare:

```bash
npm run deploy
```

Run locally:

```bash
npm run start
```

## Configuration

The workflow is configured in `wrangler.jsonc`:

```jsonc
{
  "workflows": [
    {
      "name": "spotify-researcher",
      "script_name": "spotify-researcher",
      "class_name": "SpotifyResearcher",
      "binding": "SPOTIFY_WORKFLOW"
    }
  ],
  "browser": {
    "binding": "BROWSER"
  }
}
```

## Error Handling

The workflow includes comprehensive error handling:

- Gracefully handles API failures
- Continues processing even if individual artists fail
- Logs errors for debugging
- Returns partial results when possible

## Future Enhancements

Potential improvements:

- Add support for other music genres
- Implement result caching
- Add webhook notifications for workflow completion
- Support for playlist generation
- Integration with user preferences
