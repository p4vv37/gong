import type { AgentRequestMessage, AgentResponse } from "@/lib/types";

type ChatRequest = {
  messages?: AgentRequestMessage[];
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function POST(request: Request) {
  let body: ChatRequest;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  if (
    !Array.isArray(body.messages) ||
    body.messages.some(
      (message) =>
        !message ||
        typeof message.content !== "string" ||
        (message.role !== "user" && message.role !== "assistant"),
    )
  ) {
    return Response.json({ error: "Expected OpenAI-style messages." }, { status: 400 });
  }

  await delay(2_000);

  const response: AgentResponse = {
    message: {
      type: "agent",
      content: "example response\noption A - explanation\noption B - explanation",
      artifacts: [
        {
          type: "buttons",
          buttons: [
            { id: "A", content: "A", variant: "green" },
            { id: "B", content: "B", variant: "destructive" },
          ],
        },
      ],
    },
  };

  return Response.json(response);
}
