import { config } from "./config.js";
import { JobDatabase } from "./db.js";
import { DiscordPublisher } from "./discord.js";
import { JobService } from "./service.js";
import { AshbySource } from "./sources/ashby.js";
import { GreenhouseSource } from "./sources/greenhouse.js";
import { LeverSource } from "./sources/lever.js";
import { RemoteOkSource } from "./sources/remoteok.js";
import { UsaJobsSource } from "./sources/usajobs.js";
import type { JobSource } from "./types.js";

const db = new JobDatabase(config.databasePath);
const sources: JobSource[] = [
  ...config.sources.greenhouseBoards.map((board) => new GreenhouseSource(board)),
  ...config.sources.leverSites.map((site) => new LeverSource(site)),
  ...config.sources.ashbyBoards.map((board) => new AshbySource(board)),
  ...(config.sources.remoteOk ? [new RemoteOkSource()] : []),
  ...(config.sources.usaJobs ? [new UsaJobsSource(config.usaJobsEmail, config.usaJobsApiKey)] : [])
];

let publisher: DiscordPublisher;
const service = new JobService(config, db, sources, () => publisher);
publisher = new DiscordPublisher(config, db, () => service.run());

await publisher.start();
await service.run();
setInterval(() => void service.run(), config.pollMinutes * 60_000).unref();
if (config.postSchedule) {
  const { days, times, timeZone } = config.postSchedule;
  console.log(`Posting on ${days.join(",")} at ${times.join(",")} ${timeZone}.`);
  await service.postIfDue();
  setInterval(() => void service.postIfDue().catch((error) => console.error("Scheduled post failed:", error)), 60_000);
}
console.log(`NSBE job bot started with ${sources.length} source connectors.`);
