/**
 * Model configuration for the research-side agents. The SDK default model is
 * far weaker than current flagships, so models are always set explicitly.
 * Every LLM feature degrades gracefully when OPENAI_API_KEY is absent —
 * keyless runs stay fully functional on heuristics.
 */

export const MODELS = {
  /** high-volume extraction & judging */
  fast: process.env.OPENAI_MODEL_FAST ?? "gpt-5.6-luna",
  /** final prose & synthesis */
  smart: process.env.OPENAI_MODEL_SMART ?? "gpt-5.6-terra",
};

export function llmEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
