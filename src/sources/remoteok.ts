import type { Job, JobSource } from "../types.js";
import { fetchJson, textOnly } from "./shared.js";

interface RemoteOkPosting {
  id?: string | number;
  slug?: string;
  url?: string;
  position?: string;
  company?: string;
  location?: string;
  description?: string;
  date?: string;
  tags?: string[];
  salary_min?: number;
  salary_max?: number;
}

export class RemoteOkSource implements JobSource {
  readonly name = "remoteok" as const;

  async fetchJobs(): Promise<Job[]> {
    const rows = await fetchJson<RemoteOkPosting[]>("https://remoteok.com/api");
    return rows.filter((row) => row.id && row.position && row.company && row.url).map((row) => ({
      source: this.name,
      externalId: String(row.id),
      url: row.url!,
      title: row.position!,
      company: row.company!,
      location: row.location || "Remote (eligibility unspecified)",
      description: textOnly(row.description),
      ...(row.date ? { postedAt: row.date } : {}),
      ...(row.salary_min || row.salary_max
        ? { salary: `$${row.salary_min ?? "?"}–$${row.salary_max ?? "?"}` }
        : {}),
      tags: row.tags ?? []
    }));
  }
}
