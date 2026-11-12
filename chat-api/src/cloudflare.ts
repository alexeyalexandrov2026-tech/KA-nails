import type Anthropic from "@anthropic-ai/sdk";
import type { ChatDeps, ModelReply } from "./chat";

type CompletionMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

function completionMessages(
  params: Anthropic.MessageCreateParamsNonStreaming,
): CompletionMessage[] {
  const messages: CompletionMessage[] = [];
  const system =
    typeof params.system === "string"
      ? params.system
      : params.system?.map((block) => block.text).join("\n\n");
  if (system) messages.push({ role: "system", content: system });

  for (const message of params.messages) {
    if (typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
      continue;
    }
    const text: string[] = [];
    const calls: ToolCall[] = [];
    for (const block of message.content) {
      switch (block.type) {
        case "text":
          text.push(block.text);
          break;
        case "tool_use":
          calls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
          break;
        case "tool_result":
          if (typeof block.content !== "string") {
            throw new Error("Cloudflare chat expects a text tool result");
          }
          messages.push({
            role: "tool",
            tool_call_id: block.tool_use_id,
            content: block.content,
          });
          break;
        default:
          throw new Error("Unsupported Cloudflare chat message block");
      }
    }
    const content = text.join("\n");
    if (calls.length) {
      messages.push({
        role: "assistant",
        content: content || null,
        tool_calls: calls,
      });
    } else if (content) {
      messages.push({ role: message.role, content });
    }
  }
  return messages;
}

interface Completion {
  choices?: {
    finish_reason?: string;
    message?: {
      content?: string | null;
      refusal?: string | null;
      tool_calls?: ToolCall[] | null;
    };
  }[];
}

function completionReply(data: Completion): ModelReply {
  const choice = data?.choices?.[0];
  const message = choice?.message;
  if (!message) throw new Error("Cloudflare chat returned no message");
  if (message.refusal || choice.finish_reason === "content_filter") {
    return { content: [], stop_reason: "refusal" };
  }

  const content: ModelReply["content"] = [];
  if (typeof message.content === "string" && message.content) {
    content.push({ type: "text", text: message.content, citations: null });
  }
  if (choice.finish_reason === "length") {
    return { content, stop_reason: "max_tokens" };
  }
  for (const call of message.tool_calls ?? []) {
    if (
      call?.type !== "function" ||
      typeof call.id !== "string" ||
      !call.id ||
      typeof call.function?.name !== "string" ||
      typeof call.function.arguments !== "string"
    ) {
      throw new Error("Cloudflare chat returned an invalid tool call");
    }
    let input: unknown;
    try {
      input = JSON.parse(call.function.arguments);
    } catch {
      throw new Error("Cloudflare chat returned invalid tool arguments");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Cloudflare chat returned invalid tool arguments");
    }
    content.push({
      type: "tool_use",
      caller: { type: "direct" },
      id: call.id,
      name: call.function.name,
      input,
    });
  }
  return {
    content,
    stop_reason: content.some((block) => block.type === "tool_use")
      ? "tool_use"
      : "end_turn",
  };
}

/** Workers AI's OpenAI-compatible API, adapted to the existing chat loop. */
export function cloudflareMessages(
  accountId: string | undefined,
  token: string | undefined,
  request: typeof fetch = fetch,
): ChatDeps["createMessage"] {
  return async (params) => {
    if (!accountId || !token)
      throw new Error("Cloudflare Workers AI is not configured");
    const response = await request(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model: params.model,
          messages: completionMessages(params),
          max_tokens: params.max_tokens,
          tools: params.tools?.map((tool) => {
            if (!("input_schema" in tool)) {
              throw new Error("Cloudflare chat expects a custom function tool");
            }
            return {
              type: "function",
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema,
              },
            };
          }),
          tool_choice: params.tool_choice?.type === "none" ? "none" : "auto",
        }),
      },
    );
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw Object.assign(new Error("Cloudflare Workers AI request failed"), {
        status: response.status,
      });
    }
    return completionReply((await response.json()) as Completion);
  };
}
