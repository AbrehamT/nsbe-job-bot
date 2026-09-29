import { describe, expect, it } from "vitest";
import { latestSlot, type PostSchedule } from "../src/schedule.js";

const schedule: PostSchedule = {
  timeZone: "America/Los_Angeles",
  days: ["mon", "tue", "wed", "thu", "fri"],
  times: ["09:00"]
};

describe("latestSlot", () => {
  it("is undefined before the first slot of the day", () => {
    // Tue 2026-09-29 08:59 PDT
    expect(latestSlot(new Date("2026-09-29T15:59:00Z"), schedule)).toBeUndefined();
  });

  it("returns today's slot once it has started, using the schedule's time zone", () => {
    // Tue 2026-09-29 09:00 PDT
    expect(latestSlot(new Date("2026-09-29T16:00:00Z"), schedule)).toBe("2026-09-29 09:00");
    // Tue 2026-09-29 23:30 PDT is already Wednesday in UTC
    expect(latestSlot(new Date("2026-09-30T06:30:00Z"), schedule)).toBe("2026-09-29 09:00");
  });

  it("skips days not in the schedule", () => {
    // Sat 2026-10-03 12:00 PDT
    expect(latestSlot(new Date("2026-10-03T19:00:00Z"), schedule)).toBeUndefined();
  });

  it("picks the most recent of several slots", () => {
    const twice = { ...schedule, times: ["16:00", "09:00"] };
    // Tue 2026-09-29 17:00 PDT
    expect(latestSlot(new Date("2026-09-30T00:00:00Z"), twice)).toBe("2026-09-29 16:00");
  });
});
