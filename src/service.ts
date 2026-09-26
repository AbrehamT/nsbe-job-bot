import type { Config } from "./config.js";
import type { JobDatabase } from "./db.js";
import type { DiscordPublisher } from "./discord.js";
import { scoreJob } from "./scoring.js";
import type { JobSource, ScoredJob } from "./types.js";

export class JobService {
  private running = false;

  constructor(
    private readonly config: Config,
    private readonly db: JobDatabase,
    private readonly sources: JobSource[],
    private getPublisher: () => DiscordPublisher
  ) {}

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const initialSync = !this.db.isInitialized();
      const fetched = (await Promise.allSettled(this.sources.map((source) => source.fetchJobs())))
        .flatMap((result, index) => {
          if (result.status === "fulfilled") return result.value;
          console.error(`Source ${this.sources[index]?.name ?? index} failed:`, result.reason);
          return [];
        });

      const candidates: ScoredJob[] = [];
      for (const job of fetched) {
        const inserted = this.db.save(job);
        if (!inserted) continue;
        const scored = scoreJob(job, this.config);
        if (scored.eligible) candidates.push(scored);
      }

      candidates.sort((a, b) => b.score - a.score);
      const shouldPost = !initialSync || this.config.postInitialBackfill;
      if (shouldPost) {
        for (const item of candidates.slice(0, this.config.maxPostsPerCycle)) {
          await this.getPublisher().publish(item);
          this.db.markPosted(item.job);
        }
      } else {
        console.log(`Initial sync stored ${fetched.length} jobs; posting suppressed to avoid flooding Discord.`);
      }
      this.db.markInitialized();
      console.log(`Checked ${fetched.length} jobs; ${candidates.length} new matches.`);
    } finally {
      this.running = false;
    }
  }
}
