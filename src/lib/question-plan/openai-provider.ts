import { Agent, Runner, webSearchTool } from "@openai/agents";
import { OpenAIProvider } from "@openai/agents-openai";
import OpenAI from "openai";
import type { QuestionPlanProvider } from "./provider";
import { questionPlanSchema, type QuestionPlanRequest } from "./schema";

const instructions = `
You are the category-research specialist inside a consumer purchasing agent.

Your job is to research the current product category, resolve time-sensitive language, then turn the request into the smallest high-value set of precise decisions that should be resolved before searching for products. Do not recommend products or stores yet.

Rules:
- Assume a normal consumer purchase unless the request explicitly indicates B2B, wholesale, sourcing, or supplier evaluation.
- You MUST use web search before producing the plan. Prefer current manufacturer product-family pages and other authoritative primary sources for available generations, tiers, capacities, sizes and compatibility.
- The user is actively waiting: use at most TWO web searches, then commit to the plan with what you have.
- Resolve relative language such as newest, latest, current generation or this year's from current sources, never from model memory.
- Treat relative product language as potentially ambiguous. Research the current taxonomy and determine whether interpretations such as most recently released item, current generation/family, or highest-tier current item would produce different eligible products. If they would, do not silently choose an interpretation: ask one high-priority, product-specific question using only sourced current options. Add a resolved constraint only for facts shared by every still-valid interpretation, and include its supporting source URL.
- Never encode a brand's model names, tier names, capacities or configurations in the instructions. All offered variants must come from the current research performed for this request.
- Identify product-specific aspects; never produce a generic shopping questionnaire.
- Treat warrantedDepth as a question-cost budget. 0-25 means about 3 high-impact decisions, 26-65 about 5, and 66-100 up to 7-10 when dependencies justify it.
- Each question must offer 2-5 materially different choices, including "no preference" or "decide for me" where appropriate.
- Each choice explains its consequence and maps to must, prefer, avoid, indifferent, or delegate.
- Separate product-review evidence from store/seller-review evidence.
- Product review priorities should cover category-specific real-world failures, long-term use, fit or compatibility, and manipulation/selection bias where relevant.
- Seller risk includes fulfilment, authenticity, returns, buyer protection, marketplace seller identity, payment protection, recency, review volume, and suspicious review patterns.
- Questions should resolve trade-offs, not merely collect specifications.
- Each question has a stable aspectId and a precise answerFormat. Use single_select for one mutually exclusive variant dimension, multi_select only when multiple values are genuinely acceptable, number/range with units for quantities, boolean for yes/no, and text only when structured formats cannot express the decision.
- For single_select, multi_select and boolean, provide choices with stable machineValue values. For other formats, choices must be an empty array.
- Numeric formats must set sensible min/max/step and unit based on the researched category. Non-numeric formats set these fields to null.
- Use dependencies in question wording and choices rather than offering impossible configurations. Only include options shown to exist in current sources.
- Depth reduces the number of aspects asked; it never reduces answer precision and never permits a hard request constraint to remain vague.
- At shallow depth, prioritize decisions that change product identity or eligibility: model tier/form factor, compatibility, capacity/size and budget. Cosmetic finish and seller preference come later unless the request makes them important.
- Use stable lowercase kebab-case IDs.
- State important assumptions instead of silently treating them as facts.
`.trim();

// hedge variant: no web access. Must never pretend to know the current
// market — relative language becomes a question or a stated assumption.
const unsearchedInstructions = `${instructions}

Web search is UNAVAILABLE for this run:
- Do not fabricate current model names, generations, capacities or "latest" facts.
- When the request uses relative language (newest, latest, current), turn it into a question or an explicit assumption instead of resolving it.
- Leave sources empty and only offer choices that are timelessly valid for the category.`;

/** Elicitation latency budget: the searched plan gets this long before the unsearched hedge answers instead. */
const SEARCHED_DEADLINE_MS = 15_000;

export class OpenAIQuestionPlanProvider implements QuestionPlanProvider {
  async createPlan(input: QuestionPlanRequest) {
    // no client retries: the OpenAI edge intermittently 520s with
    // retry-after: 60, and the default client silently sleeps on it —
    // failing fast into the fallbacks beats a hidden minute of waiting
    const runner = new Runner({
      workflowName: "purchase-question-plan",
      traceIncludeSensitiveData: false,
      modelProvider: new OpenAIProvider({
        openAIClient: new OpenAI({ maxRetries: 0 }),
      }),
    });

    const prompt =
      `Current date: ${new Date().toISOString().slice(0, 10)}. Create the researched decision plan for this request:\n` +
      JSON.stringify(input, null, 2);

    const makeAgent = (searched: boolean) =>
      new Agent({
        name: "Purchase category researcher",
        instructions: searched ? instructions : unsearchedInstructions,
        // fast tier, same convention as the pipeline agents. Deliberately NOT
        // OPENAI_MODEL: that env selects the full-size model, which needs
        // minutes per web-search turn and gets killed by the OpenAI edge
        // (HTTP 520) before it can answer
        model: process.env.OPENAI_MODEL_FAST ?? "gpt-5.6-luna",
        outputType: questionPlanSchema,
        tools: searched
          ? [webSearchTool({
              searchContextSize: "low",
              externalWebAccess: true,
              userLocation: { type: "approximate", country: "PL", timezone: "Europe/Warsaw" },
            })]
          : [],
        // the user is waiting on this call: cheapest effort compatible with
        // web_search, terse output
        modelSettings: { reasoning: { effort: "low" }, text: { verbosity: "low" } },
      });

    // streamed so the connection is never silent — long quiet responses get
    // dropped by the API edge with an empty 520 mid-run
    const runPlan = async (searched: boolean) => {
      const result = await runner.run(makeAgent(searched), prompt, { maxTurns: 8, stream: true });
      await result.completed;
      if (!result.finalOutput) throw new Error("The category researcher returned no structured plan.");
      return { plan: questionPlanSchema.parse(result.finalOutput), provider: "openai" as const };
    };

    // hedge: hosted web search is slow/unstable some days, so the searched
    // plan races a deadline while a search-free plan runs concurrently.
    // Preference order: searched → unsearched; both failing throws, and the
    // caller (ResilientQuestionPlanProvider) serves the mock plan.
    const searched = runPlan(true);
    const unsearched = runPlan(false);
    unsearched.catch(() => {}); // may lose the race unconsumed — not an unhandled rejection
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        searched,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`searched plan exceeded ${SEARCHED_DEADLINE_MS}ms`)), SEARCHED_DEADLINE_MS);
        }),
      ]);
    } catch (searchedError) {
      console.warn(`question-plan: searched run lost the race, using unsearched hedge — ${String(searchedError)}`);
      return await unsearched;
    } finally {
      clearTimeout(timer);
    }
  }
}
