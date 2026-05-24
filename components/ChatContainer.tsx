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

type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_call_end"; id: string; result: Record<string, unknown> }
  | { type: "done" }
  | { type: "error"; message: string };

const SUGGESTIONS = [
  "My Tims Rewards points are missing",
  "Can you check the balance on my account?",
  "How does Tims Rewards work?",
];

export function ChatContainer() {
  const [items, setItems] = useState<ChatItem[]>([]);
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
          content: `Sorry, something went sideways on our end (${event.message}). Mind trying that again?`,
          complete: true,
        },
      ]);
    }
  }

  async function handleSend(textOverride?: string) {
    const trimmed = (textOverride ?? input).trim();
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

  const isEmpty = items.length === 0 && !isStreaming;
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
        {isEmpty ? (
          <div className="flex h-full items-center justify-center px-6 py-12">
            <EmptyState onPick={(s) => handleSend(s)} />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
            {items.map((item, idx) => {
              const prevItem = items[idx - 1];
              const tightTop =
                item.kind === "tool" && prevItem?.kind === "tool"
                  ? "-mt-2"
                  : "";

              if (item.kind === "user") {
                return (
                  <div key={item.id} className="message-in">
                    <Message role="user">{item.content}</Message>
                  </div>
                );
              }
              if (item.kind === "agent") {
                return (
                  <div key={item.id} className="message-in">
                    <Message role="agent">{item.content}</Message>
                  </div>
                );
              }
              return (
                <div key={item.id} className={`message-in ${tightTop}`}>
                  <ToolCallCard
                    name={item.name}
                    args={item.args}
                    result={item.result}
                  />
                </div>
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
        )}
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
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            className="rounded-full bg-tims-red px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-tims-red-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex max-w-lg flex-col items-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-tims-red text-2xl font-extrabold text-white shadow-md">
        T
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-tims-ink sm:text-3xl">
        Tim Hortons Customer Care
      </h1>
      <p className="mt-3 text-base text-tims-ink-soft">
        Hey there! What can I help ya with today?
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-tims-border bg-tims-surface px-4 py-2 text-sm font-medium text-tims-ink shadow-sm transition hover:-translate-y-0.5 hover:border-tims-red/40 hover:bg-tims-cream"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
