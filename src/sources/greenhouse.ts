import type { Job, JobSource } from "../types.js";
import { fetchJson, textOnly } from "./shared.js";

interface GreenhouseResponse {
  jobs: Array<{
    id: number;
    title: string;
    absolute_url: string;
    updated_at?: string;
    location?: { name?: string };
    content?: string;
    departments?: Array<{ name: string }>;
  }>;
}

export class GreenhouseSource implements JobSource {
  readonly name = "greenhouse" as const;
  constructor(private readonly board: string) {}

  async fetchJobs(): Promise<Job[]> {
    const data = await fetchJson<GreenhouseResponse>(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(this.board)}/jobs?content=true`
    );
    return data.jobs.map((job) => ({
      source: this.name,
      externalId: String(job.id),
      url: job.absolute_url,
      title: job.title,
      company: this.board,
      location: job.location?.name ?? "Not specified",
      description: textOnly(job.content),
      ...(job.updated_at ? { postedAt: job.updated_at } : {}),
      tags: job.departments?.map((department) => department.name) ?? []
    }));
  }
}
