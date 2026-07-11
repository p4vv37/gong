# Agent message format

The chat client sends OpenAI-style conversation history to `POST /api/chat` as JSON:

```json
{
  "messages": [
    { "role": "user", "content": "Delete the report" },
    { "role": "assistant", "content": "Are you sure?" }
  ]
}
```

Each request message must contain:

- `role`: `user` or `assistant`
- `content`: a string

The endpoint must return one agent message in this envelope:

```json
{
  "message": {
    "type": "agent",
    "content": "Your response text",
    "artifacts": []
  }
}
```

`content` is required. Use `\n` when the response should contain explicit line breaks. `artifacts` is optional.

## Buttons

To show buttons beneath and outside the speech bubble, include a `buttons` artifact:

```json
{
  "message": {
    "type": "agent",
    "content": "This will permanently delete the report. Continue?",
    "artifacts": [
      {
        "type": "buttons",
        "buttons": [
          {
            "id": "delete-report",
            "content": "Delete report",
            "variant": "destructive"
          },
          {
            "id": "keep-report",
            "content": "Keep report",
            "variant": "green"
          }
        ]
      }
    ]
  }
}
```

Each button supports:

- `id`: a stable, unique HTML-safe identifier
- `content`: the visible label and the value reported when selected
- `variant`: optional visual role
  - `green`: safe, positive, or confirming action
  - `destructive`: dangerous or irreversible action
  - omitted: standard neutral action

Buttons are rendered as a vertical action panel below the message bubble. Once the user selects one button, the entire panel is hidden and the client appends a new user message using this exact format:

```text
user responded with: <button.content>
```

For example, selecting `Delete report` produces:

```text
user responded with: Delete report
```

That fabricated user message is included in the next request sent to the agent.

## Complete non-destructive example

```json
{
  "message": {
    "type": "agent",
    "content": "example response\noption A - explanation\noption B - explanation",
    "artifacts": [
      {
        "type": "buttons",
        "buttons": [
          { "id": "A", "content": "A", "variant": "green" },
          { "id": "B", "content": "B" }
        ]
      }
    ]
  }
}
```

Do not include `id` or `sentAt` on the returned message. The client generates both values when it receives the response.
