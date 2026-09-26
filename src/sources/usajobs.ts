import type { Job, JobSource } from "../types.js";
import { fetchJson, textOnly } from "./shared.js";

interface UsaJobsResponse {
  SearchResult: {
    SearchResultItems: Array<{
      MatchedObjectId: string;
      MatchedObjectDescriptor: {
        PositionTitle: string;
        PositionURI: string;
        OrganizationName: string;
        PositionLocationDisplay: string;
        PositionStartDate?: string;
        UserArea?: { Details?: { JobSummary?: string; LowGrade?: string; HighGrade?: string } };
        PositionSchedule?: Array<{ Name?: string }>;
        PositionRemuneration?: Array<{ MinimumRange?: string; MaximumRange?: string; Description?: string }>;
      };
    }>;
  };
}

export class UsaJobsSource implements JobSource {
  readonly name = "usajobs" as const;
  constructor(private readonly email: string, private readonly apiKey: string) {}

  async fetchJobs(): Promise<Job[]> {
    if (!this.email || !this.apiKey) return [];
    const url = new URL("https://data.usajobs.gov/api/search");
    url.searchParams.set("Keyword", "engineering");
    url.searchParams.set("HiringPath", "student;graduates");
    url.searchParams.set("WhoMayApply", "public");
    url.searchParams.set("DatePosted", "21");
    url.searchParams.set("ResultsPerPage", "100");
    const data = await fetchJson<UsaJobsResponse>(url.toString(), {
      headers: { "Authorization-Key": this.apiKey, "User-Agent": this.email }
    });
    return data.SearchResult.SearchResultItems.map(({ MatchedObjectId, MatchedObjectDescriptor: job }) => {
      const pay = job.PositionRemuneration?.[0];
      return {
        source: this.name,
        externalId: MatchedObjectId,
        url: job.PositionURI,
        title: job.PositionTitle,
        company: job.OrganizationName,
        location: job.PositionLocationDisplay,
        description: textOnly(job.UserArea?.Details?.JobSummary),
        ...(job.PositionSchedule?.[0]?.Name ? { employmentType: job.PositionSchedule[0].Name } : {}),
        ...(pay ? { salary: `${pay.MinimumRange ?? "?"}–${pay.MaximumRange ?? "?"} ${pay.Description ?? ""}`.trim() } : {}),
        ...(job.PositionStartDate ? { postedAt: job.PositionStartDate } : {}),
        tags: ["USAJOBS", "Federal"]
      };
    });
  }
}
