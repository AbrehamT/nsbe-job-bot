# UNLV NSBE Job Bot

A single-server Discord bot that collects US engineering opportunities, removes duplicates, scores them for student relevance, and publishes the strongest matches.

## Included in the MVP

- Greenhouse, Lever, Ashby, Remote OK, and USAJOBS connectors
- US engineering and early-career relevance scoring
- A small Nevada/Las Vegas ranking boost without excluding national jobs
- SQLite persistence and cross-source duplicate detection
- Initial-sync flood protection and configurable per-cycle posting limits
- Discord embeds plus `/jobs-status` and `/jobs-run-now`
- Dry-run mode for testing without Discord credentials

## Setup

Requirements: Node.js 22.5 or newer.

```bash
npm install
cp .env.example .env
cp config.example.json config.json
npm test
npm run start
```

The default `.env.example` uses `DRY_RUN=true`. The first run stores the current listings without posting them, unless `postInitialBackfill` is enabled. This prevents a newly configured bot from flooding the channel. To send a controlled sample after configuring Discord, set `DRY_RUN=false` and run `PREVIEW_COUNT=3 npm run preview`. This posts up to three currently eligible, not-yet-posted Ashby jobs.

For live Discord posting:

1. Create an application in the Discord Developer Portal and add its bot to the NSBE server.
2. Grant it View Channel, Send Messages, Embed Links, and Use Application Commands permissions.
3. Put the bot token, server ID, and target channel ID in `.env`.
4. Change `DRY_RUN=false`.

For USAJOBS, request an API key and set `USAJOBS_API_KEY` and `USAJOBS_EMAIL`. The connector safely returns no results until both are configured.

## Adding employers

ATS board identifiers are the final path segment of the company's public careers URL. Add them to `config.json`:

```json
{
  "sources": {
    "greenhouseBoards": ["example-company"],
    "leverSites": ["another-company"],
    "ashbyBoards": ["third-company"],
    "remoteOk": true,
    "usaJobs": true
  }
}
```

Run in dry-run mode after adding sources. A bad board identifier is logged without preventing the other sources from being checked.

## Operational notes

- Keep `postInitialBackfill` false for the first production run.
- The starter `config.json` includes three engineering employer boards and disables Remote OK because many remote listings do not clearly establish US eligibility.
- `npm start` polls while that process is running. Use a process manager or hosted service if the bot must survive terminal closure or a computer restart.
- Remote OK requires attribution and links back; the Discord embed includes both the source and original URL.
- Only add scraped sources after reviewing their terms and robots policy. LinkedIn, Indeed, and authenticated Handshake pages are intentionally not included.
- `data/jobs.db` contains the bot's history and should be backed up before moving hosts.
