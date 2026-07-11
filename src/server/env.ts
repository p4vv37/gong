/**
 * Env access for the research pipeline. Keys arrive via .envrc (direnv) in
 * the developer shell, or .env.local under `next dev`. Never log values.
 */

export function openaiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || undefined;
}

export function firecrawlKey(): string | undefined {
  return process.env.FIRECRAWL_API_KEY || undefined;
}

export function serpapiKey(): string | undefined {
  return process.env.SERPAPI_API_KEY || undefined;
}

export function requireKey(get: () => string | undefined, name: string): string {
  const v = get();
  if (!v) throw new Error(`${name} is not set — add it to .envrc or run in fixture mode`);
  return v;
}
