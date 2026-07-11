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

  const lastMessage = body.messages.at(-1)?.content.toLowerCase() ?? "";
  const response: AgentResponse = lastMessage.includes("options")
    ? {
        message: {
          type: "agent",
          content: "What would you prefer?",
          artifacts: [{ type: "buttons", buttons: ["A", "B", "C"] }],
        },
      }
    : { message: { type: "agent", content: "example response" } };

  return Response.json(response);
}
