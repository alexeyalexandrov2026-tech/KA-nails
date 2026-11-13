import assert from "node:assert/strict";
import { it } from "node:test";
import { studioFacts } from "../../lib/studio-facts";
import { bookingTool, TOOL_NAME } from "../src/booking-request";
import type { ModelRequest } from "../src/model";
import {
  MODELS,
  workersAiMessages,
  type WorkersAiInput,
} from "../src/workers-ai";

const base: ModelRequest = {
  model: MODELS[0],
  system: "KA Nails receptionist",
  max_tokens: 1024,
  tools: [bookingTool(studioFacts)],
  messages: [{ role: "user", content: "Yes, send it." }],
};

it("reads Gemma tool calls and sends correlated tool results without reasoning", async () => {
  const inputs: WorkersAiInput[] = [];
  const params = { service_id: "classic-pedicure", phone: "[PHONE]" };
  const run = workersAiMessages(async (model, input) => {
    assert.equal(model, base.model);
    inputs.push(input);
    const message =
      inputs.length === 1
        ? {
            role: "assistant",
            content: null,
            reasoning: "private",
            tool_calls: [
              {
                id: "call_booking",
                type: "function",
                function: {
                  name: TOOL_NAME,
                  arguments: JSON.stringify(params),
                },
              },
            ],
          }
        : {
            role: "assistant",
            content: "Could you check the service?",
            reasoning: "private",
          };
    return {
      choices: [
        { message, finish_reason: inputs.length === 1 ? "tool_calls" : "stop" },
      ],
    };
  });
  const reply = await run(base);
  assert.deepEqual(reply, {
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        id: "call_booking",
        name: TOOL_NAME,
        input: params,
      },
    ],
  });
  assert.equal(inputs[0]?.tools[0]?.function.name, TOOL_NAME);
  assert.equal(inputs[0]?.store, false);
  await run({
    ...base,
    tool_choice: { type: "none" },
    messages: [
      ...base.messages,
      { role: "assistant", content: reply.content },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_booking",
            content: "Check the service.",
            is_error: true,
          },
        ],
      },
    ],
  });
  assert.equal(inputs[1]?.tool_choice, "none");
  assert.deepEqual(inputs[1]?.messages.at(-1), {
    role: "tool",
    tool_call_id: "call_booking",
    content: "Check the service.",
  });
  assert.ok(!JSON.stringify(inputs).includes("private"));
});

it("rejects malformed tool arguments before the booking handler sees them", async () => {
  const run = workersAiMessages(async () => ({
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_booking",
              type: "function",
              function: { name: TOOL_NAME, arguments: "[" },
            },
          ],
        },
      },
    ],
  }));
  await assert.rejects(run(base), /malformed tool arguments/);
});
