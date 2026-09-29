# UNLV NSBE Job Bot

A single-server Discord bot that collects US engineering opportunities, removes duplicates, scores them for student relevance, and publishes the strongest matches.

## At a glance

| | |
|---|---|
| **Posting schedule** | Weekdays at 9:00 AM Pacific, up to 5 jobs per post, highest score first; extras carry over to the next day. Sources are checked every 60 minutes. See [Posting schedule](#posting-schedule). |
| **Hosting** | AWS EC2 `t3.micro` in `us-east-2` (instance `nsbe-job-bot`), Amazon Linux 2023, Node 24, running as the `nsbe-job-bot` systemd service from `/opt/nsbe-job-bot`. See [Deploying to EC2](#deploying-to-ec2). |
| **Deploy** | `deploy/deploy.sh` (add `--env` after changing `.env`) |
| **Logs** | `ssh -i <key> ec2-user@<host> 'journalctl -u nsbe-job-bot -f'` |
| **Cost** | About $12/month (instance $7.59, public IPv4 $3.65, 8 GB gp3 $0.64), currently covered by AWS free-plan credits that expire 2027-03-12. |

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

## Posting schedule

Sources are checked every `pollMinutes`, and new matches are queued. With `postSchedule` set, the queue is posted only at the listed local times on the listed days, highest score first, up to `maxPostsPerCycle` per slot. Anything left over carries into the next slot until it is older than `maximumAgeDays`. Remove `postSchedule` to post new matches right after each check instead.

```json
"postSchedule": {
  "timeZone": "America/Los_Angeles",
  "days": ["mon", "tue", "wed", "thu", "fri"],
  "times": ["09:00"]
}
```

If the bot is offline at a slot, it posts once when it comes back later that day. On the first start with a schedule, a slot that has already passed today is skipped rather than posted on deploy.

## Deploying to EC2

`deploy/deploy.sh` tests, builds, copies the app to `/opt/nsbe-job-bot` on the host, and restarts the `nsbe-job-bot` systemd service. Pass `--env` to upload a changed `.env`. Set `DEPLOY_HOST` and `DEPLOY_KEY` to override the defaults (the SSH user is `ec2-user`).

- `.env` and `data/jobs.db` live only on the server and are never overwritten by a normal deploy. `--seed-db` copies the local database up once and refuses if the server already has one.
- The instance's public IP changes if it is stopped and started; update `DEPLOY_HOST` (or attach an Elastic IP).
- Service control: `sudo systemctl status|restart|stop nsbe-job-bot`. It restarts on failure and starts on boot.
- The server needs Node 22.5+ for `node:sqlite` (`sudo dnf install nodejs24` on Amazon Linux 2023).

## Operational notes

- Keep `postInitialBackfill` false for the first production run.
- The starter `config.json` includes three engineering employer boards and disables Remote OK because many remote listings do not clearly establish US eligibility.
- `npm start` polls while that process is running. Use a process manager or hosted service if the bot must survive terminal closure or a computer restart.
- Remote OK requires attribution and links back; the Discord embed includes both the source and original URL.
- Only add scraped sources after reviewing their terms and robots policy. LinkedIn, Indeed, and authenticated Handshake pages are intentionally not included.
- `data/jobs.db` contains the bot's history and should be backed up before moving hosts.
