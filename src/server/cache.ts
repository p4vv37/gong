import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditKeyOf, recordAudit } from "./audit";

/**
 * Record/replay cache wrapped around every external call (SerpAPI, Firecrawl,
 * direct fetches). Modes:
 *
 *  - auto   (default): replay on hit, otherwise call live and record.
 *  - record: always call live and overwrite the recording.
 *  - replay: never call live; miss = error. Demo-day safety mode.
 *  - live:   always call live, store nothing.
 *
 * Set RESEARCH_CACHE_MODE to override. Recordings are plain JSON under
 * data/cache/<namespace>/<hash>.json so golden runs can be committed.
 */

export type CacheMode = "auto" | "record" | "replay" | "live";

export function cacheMode(): CacheMode {
  const m = process.env.RESEARCH_CACHE_MODE;
  return m === "record" || m === "replay" || m === "live" ? m : "auto";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

const cacheRoot = () => path.join(process.cwd(), "data", "cache");

export async function cached<T>(
  namespace: string,
  key: unknown,
  fn: () => Promise<T>,
  mode: CacheMode = cacheMode(),
): Promise<T> {
  const keyJson = stableStringify(key);
  const hash = createHash("sha256").update(keyJson).digest("hex").slice(0, 24);
  const file = path.join(cacheRoot(), namespace, `${hash}.json`);
  const startedAt = Date.now();
  const audit = (cacheHit: boolean, ok: boolean, error?: string) =>
    recordAudit({ source: namespace, key: auditKeyOf(key), at: new Date(startedAt).toISOString(), ms: Date.now() - startedAt, cacheHit, ok, error });

  if (mode === "auto" || mode === "replay") {
    try {
      const raw = await readFile(file, "utf8");
      const value = (JSON.parse(raw) as { value: T }).value;
      audit(true, true);
      return value;
    } catch {
      if (mode === "replay") {
        audit(true, false, "replay miss");
        throw new Error(`cache replay miss: ${namespace} ${keyJson.slice(0, 200)}`);
      }
    }
  }

  let value: T;
  try {
    value = await fn();
  } catch (err) {
    audit(false, false, String(err).slice(0, 300));
    throw err;
  }
  audit(false, true);

  if (mode !== "live") {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ namespace, key, storedAt: new Date().toISOString(), value }, null, 1));
  }
  return value;
}
