import type { ModelReply, ModelRequest, ToolUse } from "./model";

export const MODELS = [
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/qwen/qwen3.8-27b",
  "@cf/openai/gpt-oss-120b",
] as const;
export type WorkersModel = (typeof MODELS)[number];

type FunctionCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
type Message =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: FunctionCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface WorkersAiInput {
  messages: Message[];
  tools?: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }[];
  tool_choice?: "auto" | "none";
  max_completion_tokens: number;
  temperature?: number;
  chat_template_kwargs?: { enable_thinking: boolean };
  reasoning_effort?: "low";
  store: false;
  stream: false;
}

type RunModel = (
  model: WorkersModel,
  input: WorkersAiInput,
) => Promise<unknown>;

export function isWorkersModel(model: string): model is WorkersModel {
  return MODELS.some((candidate) => candidate === model);
}

function inputFor(params: ModelRequest, model: WorkersModel): WorkersAiInput {
  const messages: Message[] = [{ role: "system", content: params.system }];
  for (const message of params.messages) {
    if (typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
    } else if (message.role === "assistant") {
      const text: string[] = [];
      const calls: FunctionCall[] = [];
      for (const block of message.content) {
        if (block.type === "text") text.push(block.text);
        else {
          calls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        }
      }
      messages.push({
        role: "assistant",
        content: text.join("\n") || null,
        tool_calls: calls,
      });
    } else {
      for (const block of message.content) {
        messages.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content: block.content,
        });
      }
    }
  }
  return {
    messages,
    ...(params.tools.length > 0
      ? {
          tools: params.tools.map((tool) => ({
            type: "function" as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: { ...tool.input_schema, additionalProperties: false },
            },
          })),
          tool_choice: params.tool_choice ? "none" : "auto",
        }
      : {}),
    max_completion_tokens: params.max_tokens,
    ...(model === "@cf/openai/gpt-oss-120b"
      ? { reasoning_effort: "low" as const }
      : { temperature: 0.2, chat_template_kwargs: { enable_thinking: false } }),
    stream: false,
    store: false,
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function toolCall(value: unknown): ToolUse {
  const call = record(value);
  const fn = record(call?.function);
  if (
    call?.type !== "function" ||
    typeof call.id !== "string" ||
    !call.id ||
    typeof fn?.name !== "string" ||
    typeof fn.arguments !== "string"
  ) {
    throw new Error("Workers AI returned an invalid tool call");
  }
  let input: unknown;
  try {
    input = JSON.parse(fn.arguments);
  } catch {
    throw new Error("Workers AI returned malformed tool arguments");
  }
  if (!record(input))
    throw new Error("Workers AI returned invalid tool arguments");
  return { type: "tool_use", id: call.id, name: fn.name, input };
}

function parseReply(value: unknown): ModelReply {
  const result = record(value);
  const choice =
    Array.isArray(result?.choices) && result.choices.length === 1
      ? record(result.choices[0])
      : undefined;
  const message = record(choice?.message);
  if (!choice || !message || message.role !== "assistant") {
    throw new Error("Workers AI returned an invalid completion");
  }
  if (message.refusal || choice.finish_reason === "content_filter") {
    return { content: [], stop_reason: "refusal" };
  }
  if (choice.finish_reason === "length")
    return { content: [], stop_reason: "max_tokens" };
  const content: ModelReply["content"] = [];
  if (typeof message.content === "string" && message.content.trim()) {
    content.push({ type: "text", text: message.content });
  }
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    if (
      choice.finish_reason !== "tool_calls" ||
      message.tool_calls.length > 3
    ) {
      throw new Error("Workers AI returned unexpected tool calls");
    }
    const calls = message.tool_calls.map(toolCall);
    if (new Set(calls.map((call) => call.id)).size !== calls.length) {
      throw new Error("Workers AI returned duplicate tool call IDs");
    }
    return { content: [...content, ...calls], stop_reason: "tool_use" };
  }
  if (choice.finish_reason !== "stop")
    throw new Error("Workers AI returned an invalid finish reason");
  return { content, stop_reason: "end_turn" };
}

export function workersAiMessages(run: RunModel) {
  return async (params: ModelRequest): Promise<ModelReply> => {
    if (!isWorkersModel(params.model))
      throw new Error("Unsupported Workers AI model");
    return parseReply(await run(params.model, inputFor(params, params.model)));
  };
}
