import type { Job, ScoredJob } from "./types.js";

const engineeringTerms = [
  "aerospace", "biomedical", "chemical engineer", "civil engineer", "computer engineer",
  "electrical", "environmental engineer", "industrial engineer", "manufacturing engineer",
  "materials engineer", "mechanical", "robotics", "software engineer", "systems engineer",
  "hardware engineer", "firmware engineer", "engineering intern", "engineering co-op", "engineer i",
  "product design engineer"
];

const earlyCareerTerms = [
  "intern", "internship", "co-op", "coop", "new grad", "new graduate", "entry level",
  "entry-level", "early career", "university graduate", "rotational", "pathways"
];

// Whole words only, so "Internal Systems" or "cooperative" don't read as internships.
const earlyCareerPattern = new RegExp(
  `\\b(?:${earlyCareerTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|")})\\b`
);

const seniorTerms = [
  "senior", "sr.", "staff", "principal", "lead engineer", "manager", "director", "architect"
];

const usTerms = [
  "united states", "usa", "u.s.", "remote - us", "remote, us", "remote us",
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut",
  "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa",
  "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan",
  "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire",
  "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma",
  "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee",
  "texas", "utah", "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming"
];

const usStateCode = /,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)(?:\s|$)/i;

export interface ScoringOptions {
  minimumScore: number;
  maximumAgeDays: number;
  localBoostTerms: string[];
}

export function scoreJob(job: Job, options: ScoringOptions): ScoredJob {
  const title = job.title.toLowerCase();
  const careerSignal = `${job.title} ${job.employmentType ?? ""}`.toLowerCase();
  const location = job.location.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const engineering = engineeringTerms.some((term) => title.includes(term));
  if (engineering) {
    score += 35;
    reasons.push("engineering role");
  }

  const earlyCareer = earlyCareerPattern.test(careerSignal) ||
    /\bengineer i\b(?!i)/.test(careerSignal);
  if (earlyCareer) {
    score += 30;
    reasons.push("student or early-career opportunity");
  }

  const usLocation = usTerms.some((term) => location.includes(term)) || usStateCode.test(job.location);
  if (usLocation) {
    score += 20;
    reasons.push("United States location");
  }

  if (options.localBoostTerms.some((term) => location.includes(term.toLowerCase()))) {
    score += 5;
    reasons.push("near UNLV/Nevada");
  }

  if (job.salary) {
    score += 5;
    reasons.push("salary disclosed");
  }

  const posted = job.postedAt ? Date.parse(job.postedAt) : Number.NaN;
  const ageDays = Number.isNaN(posted) ? undefined : (Date.now() - posted) / 86_400_000;
  if (ageDays !== undefined && ageDays <= 7) {
    score += 10;
    reasons.push("recently posted");
  }

  const senior = seniorTerms.some((term) => title.includes(term));
  if (senior) score -= 60;

  const tooOld = ageDays !== undefined && ageDays > options.maximumAgeDays;
  return {
    job,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    eligible: engineering && earlyCareer && usLocation && !senior && !tooOld && score >= options.minimumScore
  };
}
