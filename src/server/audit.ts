import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-run audit of every external call. cache.ts records into the ambient
 * store when one exists (pipeline runs wrap themselves in auditStorage.run);
 * scripts and tests outside a run simply skip recording.
 */

export type AuditEntry = {
  source: string; // cache namespace: "serpapi.google_shopping", "fetch.html"...
  key: string; // short human-readable key summary (url or query)
  at: string;
  ms: number;
  cacheHit: boolean;
  ok: boolean;
  error?: string;
};

export const auditStorage = new AsyncLocalStorage<AuditEntry[]>();

export function recordAudit(entry: AuditEntry): void {
  auditStorage.getStore()?.push(entry);
}

/** Short display key: prefer url/query/domain fields over raw JSON. */
export function auditKeyOf(key: unknown): string {
  if (key && typeof key === "object") {
    const k = key as Record<string, unknown>;
    const v = k.url ?? k.query ?? k.domainUrl ?? k.domain ?? k.pageToken;
    if (typeof v === "string") return v.slice(0, 140);
  }
  return JSON.stringify(key)?.slice(0, 140) ?? "";
}
