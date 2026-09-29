import "dotenv/config";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { weekdays } from "./schedule.js";

const fileSchema = z.object({
  pollMinutes: z.number().int().min(5).default(60),
  maxPostsPerCycle: z.number().int().min(1).max(25).default(10),
  minimumScore: z.number().int().min(0).max(100).default(55),
  maximumAgeDays: z.number().int().min(1).default(21),
  postInitialBackfill: z.boolean().default(false),
  localBoostTerms: z.array(z.string()).default(["Nevada", "Las Vegas"]),
  postSchedule: z.object({
    timeZone: z.string().default("America/Los_Angeles"),
    days: z.array(z.enum(weekdays)).min(1).default(["mon", "tue", "wed", "thu", "fri"]),
    times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use 24-hour HH:MM")).min(1)
  }).optional(),
  sources: z.object({
    greenhouseBoards: z.array(z.string()).default([]),
    leverSites: z.array(z.string()).default([]),
    ashbyBoards: z.array(z.string()).default([]),
    remoteOk: z.boolean().default(true),
    usaJobs: z.boolean().default(true)
  })
});

function requiredWhenLive(name: string): string {
  const value = process.env[name];
  if (!value && process.env.DRY_RUN !== "true") {
    throw new Error(`${name} is required unless DRY_RUN=true`);
  }
  return value ?? "";
}

const configPath = process.env.CONFIG_PATH ?? "./config.json";
const file = fileSchema.parse(JSON.parse(readFileSync(configPath, "utf8")));

export const config = {
  ...file,
  discordToken: requiredWhenLive("DISCORD_TOKEN"),
  discordGuildId: requiredWhenLive("DISCORD_GUILD_ID"),
  discordChannelId: requiredWhenLive("DISCORD_CHANNEL_ID"),
  databasePath: process.env.DATABASE_PATH ?? "./data/jobs.db",
  dryRun: process.env.DRY_RUN === "true",
  usaJobsApiKey: process.env.USAJOBS_API_KEY ?? "",
  usaJobsEmail: process.env.USAJOBS_EMAIL ?? ""
};

export type Config = typeof config;
