import type { Job, JobSource } from "../types.js";
import { fetchJson, textOnly } from "./shared.js";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  descriptionPlain?: string;
  categories?: { location?: string; team?: string; commitment?: string };
}

export class LeverSource implements JobSource {
  readonly name = "lever" as const;
  constructor(private readonly site: string) {}

  async fetchJobs(): Promise<Job[]> {
    const jobs = await fetchJson<LeverPosting[]>(
      `https://api.lever.co/v0/postings/${encodeURIComponent(this.site)}?mode=json`
    );
    return jobs.map((job) => ({
      source: this.name,
      externalId: job.id,
      url: job.hostedUrl,
      title: job.text,
      company: this.site,
      location: job.categories?.location ?? "Not specified",
      description: textOnly(job.descriptionPlain),
      ...(job.categories?.commitment ? { employmentType: job.categories.commitment } : {}),
      ...(job.createdAt ? { postedAt: new Date(job.createdAt).toISOString() } : {}),
      tags: job.categories?.team ? [job.categories.team] : []
    }));
  }
}
