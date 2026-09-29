import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Job } from "./types.js";

export class JobDatabase {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY,
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT NOT NULL,
        payload TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        posted_at TEXT,
        UNIQUE(source, external_id)
      );
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    const columns = this.db.prepare("PRAGMA table_info(jobs)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "queued_at")) {
      this.db.exec("ALTER TABLE jobs ADD COLUMN queued_at TEXT");
    }
  }

  save(job: Job): boolean {
    const fingerprint = makeFingerprint(job);
    const existing = this.db.prepare(
      "SELECT id FROM jobs WHERE (source = ? AND external_id = ?) OR fingerprint = ? LIMIT 1"
    ).get(job.source, job.externalId, fingerprint) as { id: number } | undefined;

    const now = new Date().toISOString();
    if (existing) {
      this.db.prepare(`
        UPDATE jobs SET url = ?, title = ?, company = ?, location = ?, payload = ?, last_seen = ?
        WHERE id = ?
      `).run(job.url, job.title, job.company, job.location, JSON.stringify(job), now, existing.id);
      return false;
    }

    this.db.prepare(`
      INSERT INTO jobs
        (source, external_id, fingerprint, url, title, company, location, payload, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.source,
      job.externalId,
      fingerprint,
      job.url,
      job.title,
      job.company,
      job.location,
      JSON.stringify(job),
      now,
      now
    );
    return true;
  }

  markPosted(job: Job): void {
    this.db.prepare("UPDATE jobs SET posted_at = ? WHERE source = ? AND external_id = ?")
      .run(new Date().toISOString(), job.source, job.externalId);
  }

  markQueued(job: Job): void {
    this.db.prepare("UPDATE jobs SET queued_at = ? WHERE source = ? AND external_id = ?")
      .run(new Date().toISOString(), job.source, job.externalId);
  }

  queuedJobs(): Job[] {
    const rows = this.db.prepare(
      "SELECT payload FROM jobs WHERE queued_at IS NOT NULL AND posted_at IS NULL"
    ).all() as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as Job);
  }

  unpostedJobs(): Job[] {
    const rows = this.db.prepare("SELECT payload FROM jobs WHERE posted_at IS NULL").all() as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as Job);
  }

  isInitialized(): boolean {
    return Boolean(this.db.prepare("SELECT value FROM metadata WHERE key = 'initial_sync_done'").get());
  }

  markInitialized(): void {
    this.db.prepare("INSERT OR REPLACE INTO metadata(key, value) VALUES('initial_sync_done', ?)")
      .run(new Date().toISOString());
  }

  getMeta(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM metadata WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value;
  }

  setMeta(key: string, value: string): void {
    this.db.prepare("INSERT OR REPLACE INTO metadata(key, value) VALUES(?, ?)").run(key, value);
  }

  stats(): { total: number; posted: number; queued: number } {
    return this.db.prepare(`
      SELECT COUNT(*) AS total, COUNT(posted_at) AS posted,
        COUNT(CASE WHEN queued_at IS NOT NULL AND posted_at IS NULL THEN 1 END) AS queued
      FROM jobs
    `).get() as { total: number; posted: number; queued: number };
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function makeFingerprint(job: Job): string {
  return [job.company, job.title, job.location].map(normalize).join("|");
}
