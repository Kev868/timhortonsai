type Props = {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
};

type Result = Record<string, unknown>;

function isError(result: Result): boolean {
  if ("error" in result && result.error !== undefined) return true;
  if ("success" in result && result.success === false) return true;
  return false;
}

export function ToolCallCard({ result }: Props) {
  const pending = result === null;
  const errored = !pending && isError(result);

  if (!pending && !errored) {
    return null;
  }

  if (errored) {
    return (
      <div className="ml-12 flex items-center gap-2 text-sm text-tims-ink-soft">
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
        <span>Something didn&apos;t go through.</span>
      </div>
    );
  }

  return (
    <div className="ml-12 flex items-center gap-2 text-sm text-tims-ink-soft">
      <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
      <span>Thinking…</span>
    </div>
  );
}
