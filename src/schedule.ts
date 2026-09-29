export const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof weekdays)[number];

export interface PostSchedule {
  timeZone: string;
  days: Weekday[];
  times: string[];
}

function localParts(now: Date, timeZone: string): { date: string; day: Weekday; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now).map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: String(parts.weekday).toLowerCase() as Weekday,
    time: `${parts.hour}:${parts.minute}`
  };
}

/**
 * Key of the most recent posting slot that has already started today (in the schedule's
 * time zone), e.g. "2026-09-29 09:00", or undefined if none has started yet today.
 */
export function latestSlot(now: Date, schedule: PostSchedule): string | undefined {
  const local = localParts(now, schedule.timeZone);
  if (!schedule.days.includes(local.day)) return undefined;
  const started = schedule.times.filter((time) => time <= local.time).sort();
  const last = started.at(-1);
  return last ? `${local.date} ${last}` : undefined;
}
