"use client";

import { useEffect, useRef, useState } from "react";
import { Message } from "./Message";
import { ToolCallCard } from "./ToolCallCard";

type UserItem = { kind: "user"; id: string; content: string };
type AgentItem = {
  kind: "agent";
  id: string;
  content: string;
  complete: boolean;
};
type ToolItem = {
  kind: "tool";
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
  startMs: number;
  endMs: number | null;
};
type ChatItem = UserItem | AgentItem | ToolItem;

const WELCOME: AgentItem = {
  kind: "agent",
  id: "welcome",
  content: "Hey there, Tim Hortons Customer Care. What's going on?",
  complete: true,
};

type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_call_end"; id: string; result: Record<string, unknown> }
  | { type: "done" }
  | { type: "error"; message: string };

export function ChatContainer() {
  const [items, setItems] = useState<ChatItem[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [items]);

  function handleEvent(event: StreamEvent) {
    if (event.type === "text_delta") {
      const text = event.text;
      setItems((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.kind === "agent" && !last.complete) {
          return prev.map((it, i) =>
            i === prev.length - 1 && it.kind === "agent"
              ? { ...it, content: it.content + text }
              : it
          );
        }
        return [
          ...prev,
          {
            kind: "agent",
            id: crypto.randomUUID(),
            content: text,
            complete: false,
          },
        ];
      });
    } else if (event.type === "tool_call_start") {
      setItems((prev) => {
        const finalized = prev.map((it) =>
          it.kind === "agent" && !it.complete ? { ...it, complete: true } : it
        );
        return [
          ...finalized,
          {
            kind: "tool",
            id: event.id,
            name: event.name,
            args: event.args,
            result: null,
            startMs: Date.now(),
            endMs: null,
          },
        ];
      });
    } else if (event.type === "tool_call_end") {
      setItems((prev) =>
        prev.map((it) =>
          it.kind === "tool" && it.id === event.id
            ? { ...it, result: event.result, endMs: Date.now() }
            : it
        )
      );
    } else if (event.type === "error") {
      setItems((prev) => [
        ...prev,
        {
          kind: "agent",
          id: crypto.randomUUID(),
          content: `Sorry, something went wrong on our end (${event.message}). Mind trying that again?`,
          complete: true,
        },
      ]);
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userItem: UserItem = {
      kind: "user",
      id: crypto.randomUUID(),
      content: trimmed,
    };
    const nextItems: ChatItem[] = [...items, userItem];
    setItems(nextItems);
    setInput("");
    setIsStreaming(true);

    const history = nextItems
      .filter(
        (it): it is UserItem | AgentItem =>
          it.kind === "user" || it.kind === "agent"
      )
      .map((it) => ({ role: it.kind, content: it.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          try {
            handleEvent(JSON.parse(trimmedLine) as StreamEvent);
          } catch {
            // ignore parse failures on partial lines
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "connection dropped";
      setItems((prev) => [
        ...prev,
        {
          kind: "agent",
          id: crypto.randomUUID(),
          content: `Sorry, ${msg}. Mind trying that again?`,
          complete: true,
        },
      ]);
    } finally {
      setIsStreaming(false);
      setItems((prev) =>
        prev.map((it) =>
          it.kind === "agent" && !it.complete ? { ...it, complete: true } : it
        )
      );
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const lastUserIdx = items.reduce(
    (acc, it, i) => (it.kind === "user" ? i : acc),
    -1
  );
  const showThinking =
    isStreaming &&
    lastUserIdx >= 0 &&
    items.slice(lastUserIdx + 1).length === 0;

  return (
    <main className="flex flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
          {items.map((item) => {
            if (item.kind === "user") {
              return (
                <Message key={item.id} role="user">
                  {item.content}
                </Message>
              );
            }
            if (item.kind === "agent") {
              return (
                <Message key={item.id} role="agent">
                  {item.content}
                </Message>
              );
            }
            return (
              <ToolCallCard
                key={item.id}
                name={item.name}
                args={item.args}
                result={item.result}
                startMs={item.startMs}
                endMs={item.endMs}
              />
            );
          })}
          {showThinking && (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-tims-red text-base font-extrabold text-white shadow-sm">
                T
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-tims-border bg-tims-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isStreaming}
            placeholder="Message Tim Hortons Care…"
            className="flex-1 rounded-full border border-tims-border bg-tims-cream px-5 py-3 text-[15px] text-tims-ink placeholder:text-tims-ink-soft focus:outline-none focus:ring-2 focus:ring-tims-red/30 disabled:cursor-not-allowed disabled:opacity-70"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="rounded-full bg-tims-red px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-tims-red-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
