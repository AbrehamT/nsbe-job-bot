import { config } from "./config.js";
import { JobDatabase } from "./db.js";
import { DiscordPublisher } from "./discord.js";
import { scoreJob } from "./scoring.js";
import { AshbySource } from "./sources/ashby.js";
import type { ScoredJob } from "./types.js";

if (config.dryRun) throw new Error("Set DRY_RUN=false before posting a preview");
const previewCount = Number(process.env.PREVIEW_COUNT ?? "3");
if (!Number.isInteger(previewCount) || previewCount < 1 || previewCount > 3) {
  throw new Error("PREVIEW_COUNT must be an integer from 1 to 3");
}

const db = new JobDatabase(config.databasePath);
const sources = config.sources.ashbyBoards.map((board) => new AshbySource(board));
const fetched = await Promise.all(sources.map((source) => source.fetchJobs()));
for (const job of fetched.flat()) {
  db.save(job);
}

const candidates: ScoredJob[] = db.unpostedJobs()
  .map((job) => scoreJob(job, config))
  .filter((item) => item.eligible && item.job.source === "ashby");
candidates.sort((a, b) => b.score - a.score || Date.parse(b.job.postedAt ?? "") - Date.parse(a.job.postedAt ?? ""));
const selected: ScoredJob[] = [];
const companies = new Set<string>();
for (const candidate of candidates) {
  if (companies.has(candidate.job.company)) continue;
  selected.push(candidate);
  companies.add(candidate.job.company);
  if (selected.length === previewCount) break;
}

if (selected.length < previewCount) {
  for (const candidate of candidates) {
    if (selected.includes(candidate)) continue;
    selected.push(candidate);
    if (selected.length === previewCount) break;
  }
}

const publisher = new DiscordPublisher(config, db, async () => {});
try {
  await publisher.start();
  for (const item of selected) {
    await publisher.publish(item);
    db.markPosted(item.job);
    console.log(`Posted: ${item.job.title} — ${item.job.company}`);
  }
} finally {
  await publisher.stop();
}
console.log(`Preview complete: ${selected.length} jobs posted.`);
