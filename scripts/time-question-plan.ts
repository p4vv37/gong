import { Agent, Runner, webSearchTool } from "@openai/agents";
import { OpenAIProvider } from "@openai/agents-openai";
import OpenAI from "openai";
import { questionPlanSchema } from "../src/lib/question-plan/schema";

/** One instrumented elicitation run: prints elapsed ms per stream item. */

const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

const noSearch = process.argv.includes("--no-search");
const agent = new Agent({
  name: "Purchase category researcher",
  instructions: noSearch
    ? "Without web access, produce the smallest set of 3 high-value purchase questions. Do not fabricate current model facts. Write tersely: every prose field is one short sentence, no filler."
    : "Research the product category briefly (at most TWO web searches), then produce the smallest set of 3 high-value purchase questions. Write tersely: every prose field is one short sentence, no filler.",
  model: process.env.OPENAI_MODEL_FAST ?? "gpt-5.6-luna",
  outputType: questionPlanSchema,
  tools: noSearch
    ? []
    : [webSearchTool({
        searchContextSize: "low",
        externalWebAccess: true,
        userLocation: { type: "approximate", country: "PL", timezone: "Europe/Warsaw" },
      })],
  modelSettings: { reasoning: { effort: "low" } },
});

const runner = new Runner({
  workflowName: "time-question-plan",
  traceIncludeSensitiveData: false,
  modelProvider: new OpenAIProvider({ openAIClient: new OpenAI({ maxRetries: 0 }) }),
});

async function main() {
const result = await runner.run(
  agent,
  'Request: "kurtka przeciwdeszczowa miejska, do 400 zł", warrantedDepth 20',
  { maxTurns: 8, stream: true },
);

let firstDelta = false;
for await (const event of result) {
  if (event.type === "raw_model_stream_event" && !firstDelta) {
    firstDelta = true;
    console.log(at(), "first model byte");
  }
  if (event.type === "run_item_stream_event") {
    console.log(at(), event.name);
  }
}
await result.completed;
console.log(at(), "DONE, questions:", (result.finalOutput as { questions?: unknown[] } | undefined)?.questions?.length);
}
main();
