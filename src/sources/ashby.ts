import type { Job, JobSource } from "../types.js";
import { fetchJson, textOnly } from "./shared.js";

interface AshbyResponse {
  jobs: Array<{
    id: string;
    title: string;
    jobUrl: string;
    location?: string;
    descriptionPlain?: string;
    employmentType?: string;
    publishedAt?: string;
    department?: string;
    compensation?: { compensationTierSummary?: string };
  }>;
}

export class AshbySource implements JobSource {
  readonly name = "ashby" as const;
  constructor(private readonly board: string) {}

  private get company(): string {
    return {
      "rivianvw.tech": "Rivian and Volkswagen Group Technologies",
      "allen-control-systems": "Allen Control Systems",
      skydio: "Skydio"
    }[this.board] ?? this.board;
  }

  async fetchJobs(): Promise<Job[]> {
    const data = await fetchJson<AshbyResponse>(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(this.board)}?includeCompensation=true`
    );
    return data.jobs.map((job) => ({
      source: this.name,
      externalId: job.id,
      url: job.jobUrl,
      title: job.title,
      company: this.company,
      location: job.location ?? "Not specified",
      description: textOnly(job.descriptionPlain),
      ...(job.employmentType ? { employmentType: job.employmentType } : {}),
      ...(job.compensation?.compensationTierSummary ? { salary: job.compensation.compensationTierSummary } : {}),
      ...(job.publishedAt ? { postedAt: job.publishedAt } : {}),
      tags: job.department ? [job.department] : []
    }));
  }
}
