export interface ModelTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, object>;
    required: string[];
  };
}

export type TextBlock = { type: "text"; text: string };
export type ToolUse = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
};
export type ToolResult = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: true;
};

export type ModelMessage =
  | { role: "user" | "assistant"; content: string }
  | { role: "assistant"; content: (TextBlock | ToolUse)[] }
  | { role: "user"; content: ToolResult[] };

export interface ModelRequest {
  model: string;
  system: string;
  max_tokens: number;
  tools: ModelTool[];
  tool_choice?: { type: "none" };
  messages: ModelMessage[];
}

export interface ModelReply {
  content: (TextBlock | ToolUse)[];
  stop_reason: "end_turn" | "tool_use" | "refusal" | "max_tokens";
}
