// Posts the queued jobs immediately (up to maxPostsPerCycle) instead of waiting for the next scheduled slot.
import { config } from "./config.js";
import { JobDatabase } from "./db.js";
import { DiscordPublisher } from "./discord.js";
import { JobService } from "./service.js";

const db = new JobDatabase(config.databasePath);
const publisher = new DiscordPublisher(config, db, async () => {});
const service = new JobService(config, db, [], () => publisher);
try {
  await publisher.start();
  await service.postQueued();
} finally {
  await publisher.stop();
}
