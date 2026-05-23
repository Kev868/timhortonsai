import type { NextRequest } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getOpenAI, MODEL } from "@/lib/openai";
import { callTool, resetMockState, toolSchemas } from "@/lib/tools";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

type ClientMessage = { role: "user" | "agent"; content: string };

const MAX_ITERATIONS = 8;

export async function POST(req: NextRequest) {
  const { messages: clientMessages } = (await req.json()) as {
    messages: ClientMessage[];
  };

  const encoder = new TextEncoder();
  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = `${SYSTEM_PROMPT}\n\nToday's date is ${today}.`;

  if (clientMessages.filter((m) => m.role === "user").length <= 1) {
    resetMockState();
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...clientMessages.map((m) => ({
      role: m.role === "agent" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          const completion = await getOpenAI().chat.completions.create({
            model: MODEL,
            messages,
            tools: toolSchemas,
            stream: true,
          });

          let accumulatedContent = "";
          const accumulatedToolCalls: Record<
            number,
            { id: string; name: string; arguments: string }
          > = {};
          let finishReason: string | null = null;

          for await (const chunk of completion) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            if (choice.delta.content) {
              accumulatedContent += choice.delta.content;
              send({ type: "text_delta", text: choice.delta.content });
            }

            if (choice.delta.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const idx = tc.index;
                if (!accumulatedToolCalls[idx]) {
                  accumulatedToolCalls[idx] = { id: "", name: "", arguments: "" };
                }
                if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                if (tc.function?.name) {
                  accumulatedToolCalls[idx].name += tc.function.name;
                }
                if (tc.function?.arguments) {
                  accumulatedToolCalls[idx].arguments += tc.function.arguments;
                }
              }
            }

            if (choice.finish_reason) finishReason = choice.finish_reason;
          }

          if (
            finishReason === "tool_calls" &&
            Object.keys(accumulatedToolCalls).length > 0
          ) {
            const toolCalls = Object.values(accumulatedToolCalls).map(
              (tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.arguments },
              })
            );

            messages.push({
              role: "assistant",
              content: accumulatedContent || null,
              tool_calls: toolCalls,
            });

            for (const tc of toolCalls) {
              const args = safeJsonParse(tc.function.arguments);
              send({
                type: "tool_call_start",
                id: tc.id,
                name: tc.function.name,
                args,
              });
              const result = await callTool(tc.function.name, args);
              send({ type: "tool_call_end", id: tc.id, result });
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(result),
              });
            }

            continue;
          }

          if (accumulatedContent) {
            messages.push({ role: "assistant", content: accumulatedContent });
          }
          send({ type: "done" });
          break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function safeJsonParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
