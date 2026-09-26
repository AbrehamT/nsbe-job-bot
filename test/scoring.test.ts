import { describe, expect, it } from "vitest";
import { makeFingerprint } from "../src/db.js";
import { scoreJob } from "../src/scoring.js";
import type { Job } from "../src/types.js";

const base: Job = {
  source: "greenhouse",
  externalId: "1",
  url: "https://example.com/job/1",
  title: "Mechanical Engineering Intern",
  company: "Example Aerospace",
  location: "Las Vegas, NV",
  description: "Paid summer internship for undergraduate engineering students.",
  postedAt: new Date().toISOString(),
  tags: ["Engineering"]
};

const options = { minimumScore: 55, maximumAgeDays: 21, localBoostTerms: ["Nevada", "Las Vegas"] };

describe("scoreJob", () => {
  it("accepts a recent local engineering internship", () => {
    const result = scoreJob(base, options);
    expect(result.eligible).toBe(true);
    expect(result.score).toBe(100);
    expect(result.reasons).toContain("near UNLV/Nevada");
  });

  it("rejects senior roles", () => {
    const result = scoreJob({ ...base, title: "Senior Mechanical Engineer" }, options);
    expect(result.eligible).toBe(false);
  });

  it("rejects non-US roles", () => {
    const result = scoreJob({ ...base, location: "Berlin, Germany" }, options);
    expect(result.eligible).toBe(false);
  });

  it("rejects experienced roles even when their descriptions mention internships", () => {
    const result = scoreJob({ ...base, title: "Mechanical Engineer" }, options);
    expect(result.eligible).toBe(false);
  });

  it("does not mistake Engineer II for Engineer I", () => {
    const result = scoreJob({ ...base, title: "Software Engineer II - Streaming" }, options);
    expect(result.eligible).toBe(false);
  });

  it("rejects remote roles without explicit US eligibility", () => {
    const result = scoreJob({ ...base, location: "Remote (eligibility unspecified)" }, options);
    expect(result.eligible).toBe(false);
  });

  it("does not mistake a foreign province code for a US state", () => {
    const result = scoreJob({ ...base, location: "Toronto, ON" }, options);
    expect(result.eligible).toBe(false);
  });
});

describe("makeFingerprint", () => {
  it("normalizes formatting differences", () => {
    expect(makeFingerprint(base)).toBe(
      makeFingerprint({ ...base, title: " Mechanical-Engineering Intern! ", company: "EXAMPLE AEROSPACE" })
    );
  });
});
