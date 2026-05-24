type Props = {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
};

const PENDING: Record<string, string> = {
  lookup_account: "Looking up the account…",
  check_rewards_balance: "Checking the rewards balance…",
  restore_rewards_points: "Restoring the points…",
  issue_perk: "Issuing a perk…",
  lookup_faq: "Searching the FAQ…",
  scope_check: "Checking topic scope…",
};

const FAILED: Record<string, string> = {
  lookup_account: "Couldn't find that account.",
  check_rewards_balance: "Couldn't pull the balance.",
  restore_rewards_points: "Couldn't restore the points.",
  issue_perk: "Couldn't issue the perk.",
  lookup_faq: "FAQ search came up empty.",
  scope_check: "Scope check errored.",
};

type Result = Record<string, unknown>;

const DONE: Record<string, (args: Result, result: Result) => string> = {
  lookup_account: (_args, r) => {
    const parts: string[] = [];
    if (typeof r.name === "string") parts.push(r.name);
    if (typeof r.tier === "string") parts.push(`${r.tier} member`);
    if (typeof r.home_store === "string") {
      const short = r.home_store.replace(/^Tim Hortons #\d+,\s*/, "");
      parts.push(short);
    }
    return parts.length
      ? `Looked up the account: ${parts.join(", ")}.`
      : "Looked up the account.";
  },
  check_rewards_balance: (_args, r) => {
    const visible = typeof r.visible_balance === "number" ? r.visible_balance : "?";
    const expected =
      typeof r.expected_balance === "number" ? r.expected_balance : "?";
    if (r.discrepancy_flag === true) {
      return `Checked the balance: visible ${visible}, expected ${expected} (sync issue).`;
    }
    return `Checked the balance: ${visible} points.`;
  },
  restore_rewards_points: (_args, r) => {
    const n = typeof r.new_balance === "number" ? r.new_balance : "?";
    return `Restored ${n} points to the account.`;
  },
  issue_perk: (args, r) => {
    const perk = String(args.perk_type ?? "").replace(/_/g, " ");
    const valid = typeof r.valid_until === "string" ? formatDate(r.valid_until) : "?";
    return `Issued ${perk} perk, valid until ${valid}.`;
  },
  lookup_faq: (args, r) => {
    const query = String(args.query ?? "");
    const matches = Array.isArray(r.matches) ? r.matches : [];
    if (matches.length === 0) return `Searched the FAQ for "${query}": no matches.`;
    const top = matches[0] as { question?: string; score?: number };
    const score = typeof top.score === "number" ? top.score.toFixed(2) : "?";
    return `Searched the FAQ for "${query}": top match "${top.question ?? "?"}" (similarity ${score}).`;
  },
  scope_check: (_args, r) => {
    const inScope = r.in_scope === true;
    const reason = typeof r.reason === "string" ? r.reason : "";
    return inScope
      ? `Scope check: in scope${reason ? " — " + reason : ""}.`
      : `Scope check: OUT OF SCOPE${reason ? " — " + reason : ""}. Refusing.`;
  },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function isError(result: Result): boolean {
  if ("error" in result && result.error !== undefined) return true;
  if ("success" in result && result.success === false) return true;
  return false;
}

export function ToolCallCard({ name, args, result }: Props) {
  let label: string;
  let dotClass: string;

  if (result === null) {
    label = PENDING[name] ?? "Working…";
    dotClass = "animate-pulse bg-amber-500";
  } else if (isError(result)) {
    label = FAILED[name] ?? "Something didn't go through.";
    dotClass = "bg-rose-500";
  } else {
    label = DONE[name]?.(args, result) ?? "Done.";
    dotClass = "bg-emerald-500";
  }

  return (
    <div className="ml-12 flex items-center gap-2 text-sm text-tims-ink-soft">
      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
}
