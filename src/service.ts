import type { Config } from "./config.js";
import type { JobDatabase } from "./db.js";
import type { DiscordPublisher } from "./discord.js";
import { latestSlot } from "./schedule.js";
import { scoreJob } from "./scoring.js";
import type { JobSource } from "./types.js";

export class JobService {
  private running = false;
  private posting = false;

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

      const shouldQueue = !initialSync || this.config.postInitialBackfill;
      let matches = 0;
      for (const job of fetched) {
        const inserted = this.db.save(job);
        if (!inserted || !scoreJob(job, this.config).eligible) continue;
        matches++;
        if (shouldQueue) this.db.markQueued(job);
      }

      if (!shouldQueue) {
        console.log(`Initial sync stored ${fetched.length} jobs; posting suppressed to avoid flooding Discord.`);
      }
      this.db.markInitialized();
      console.log(`Checked ${fetched.length} jobs; ${matches} new matches.`);
    } finally {
      this.running = false;
    }
    if (!this.config.postSchedule) await this.postQueued();
  }

  /** Posts the queue if a scheduled slot has started today and hasn't been posted yet. */
  async postIfDue(now = new Date()): Promise<void> {
    const schedule = this.config.postSchedule;
    if (!schedule) return;
    const slot = latestSlot(now, schedule);
    const lastSlot = this.db.getMeta("last_post_slot");
    if (!slot || slot === lastSlot) return;
    this.db.setMeta("last_post_slot", slot);
    if (lastSlot === undefined) {
      // First start with a schedule: wait for the next slot rather than posting on deploy.
      console.log(`Posting schedule active; skipping already-started slot ${slot}.`);
      return;
    }
    console.log(`Posting slot ${slot}.`);
    await this.postQueued();
  }

  /** Posts the highest-scoring queued jobs that are still eligible; the rest carry over. */
  async postQueued(): Promise<void> {
    if (this.posting) return;
    this.posting = true;
    try {
      const candidates = this.db.queuedJobs()
        .map((job) => scoreJob(job, this.config))
        .filter((item) => item.eligible)
        .sort((a, b) => b.score - a.score);
      const batch = candidates.slice(0, this.config.maxPostsPerCycle);
      for (const item of batch) {
        await this.getPublisher().publish(item);
        this.db.markPosted(item.job);
      }
      console.log(`Posted ${batch.length} jobs; ${candidates.length - batch.length} still queued.`);
    } finally {
      this.posting = false;
    }
  }
}
