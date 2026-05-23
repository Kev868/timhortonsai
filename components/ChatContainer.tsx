import { Message } from "./Message";

export function ChatContainer() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
          <Message role="user">
            Hey, just placed a mobile order and my Tims Rewards is showing 0
            points. I had 850 yesterday and was planning to grab a free coffee
            on my way to work. What’s going on?
          </Message>
          <Message role="agent">
            Oh no, the Tims app is acting up again, eh? Let me pull up your
            account and figure out what happened. One sec.
          </Message>
        </div>
      </div>
      <div className="border-t border-tims-border bg-tims-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-4">
          <input
            type="text"
            disabled
            placeholder="Message Tim Hortons Care…"
            className="flex-1 rounded-full border border-tims-border bg-tims-cream px-5 py-3 text-[15px] text-tims-ink placeholder:text-tims-ink-soft focus:outline-none focus:ring-2 focus:ring-tims-red/30 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            className="rounded-full bg-tims-red px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-tims-red-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
