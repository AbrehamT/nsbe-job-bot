export type SourceName = "greenhouse" | "lever" | "ashby" | "remoteok" | "usajobs";

export interface Job {
  source: SourceName;
  externalId: string;
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
  employmentType?: string;
  salary?: string;
  postedAt?: string;
  tags: string[];
}

export interface ScoredJob {
  job: Job;
  score: number;
  reasons: string[];
  eligible: boolean;
}

export interface JobSource {
  readonly name: SourceName;
  fetchJobs(): Promise<Job[]>;
}
