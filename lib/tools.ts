import accountsData from "@/data/mock-accounts.json";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { retrieveFaq } from "./rag";

type Transaction = {
  date: string;
  location: string;
  amount: number;
  points_earned: number;
  points_balance_after: number;
};

type Account = {
  account_id: string;
  name: string;
  phone: string;
  email: string;
  home_store: string;
  tier: "Standard" | "Gold";
  member_since: string;
  visible_balance: number;
  expected_balance: number;
  discrepancy_flag: boolean;
  discrepancy_reason?: string;
  last_5_transactions: Transaction[];
};

const INITIAL_ACCOUNTS = JSON.parse(
  JSON.stringify(accountsData.accounts)
) as Account[];

const accounts: Account[] = JSON.parse(
  JSON.stringify(INITIAL_ACCOUNTS)
) as Account[];

export function resetMockState(): void {
  accounts.length = 0;
  accounts.push(...(JSON.parse(JSON.stringify(INITIAL_ACCOUNTS)) as Account[]));
}

export const toolSchemas: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_account",
      description:
        "Look up a Tim Hortons Rewards account by phone number or email address.",
      parameters: {
        type: "object",
        properties: {
          phone_or_email: {
            type: "string",
            description:
              "Customer's phone number (e.g. +14165551234) or email address (e.g. sarah.chen@gmail.com).",
          },
        },
        required: ["phone_or_email"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_rewards_balance",
      description:
        "Get the customer-visible rewards balance, the system-of-truth balance, a discrepancy flag, and the last 5 transactions for an account.",
      parameters: {
        type: "object",
        properties: {
          account_id: {
            type: "string",
            description: "Tim Hortons account id, e.g. A4F2B1.",
          },
        },
        required: ["account_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "restore_rewards_points",
      description:
        "Restore a customer's rewards balance to its correct value. Use this when check_rewards_balance reports a discrepancy.",
      parameters: {
        type: "object",
        properties: {
          account_id: {
            type: "string",
            description: "Tim Hortons account id, e.g. A4F2B1.",
          },
          correct_points: {
            type: "number",
            description:
              "The balance to restore to. Typically the expected_balance from check_rewards_balance.",
          },
        },
        required: ["account_id", "correct_points"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_faq",
      description:
        "Search the Tim Hortons FAQ knowledge base for information about policies, rewards program details, mobile orders, menu, store services, etc. Use this for any informational question the customer asks where the answer is not derivable from their account data. Returns the top matching FAQ entries with a similarity score.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The customer's question rephrased as a concise search query.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "issue_perk",
      description:
        "Grant a goodwill perk on the customer's account. Use this to make things right after a service issue.",
      parameters: {
        type: "object",
        properties: {
          account_id: {
            type: "string",
            description: "Tim Hortons account id, e.g. A4F2B1.",
          },
          perk_type: {
            type: "string",
            enum: ["free_coffee", "double_points_day", "free_donut"],
            description: "Which goodwill perk to grant.",
          },
        },
        required: ["account_id", "perk_type"],
        additionalProperties: false,
      },
    },
  },
];

type ToolResult = Record<string, unknown>;

export async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case "lookup_account":
      return lookupAccount(String(args.phone_or_email ?? ""));
    case "check_rewards_balance":
      return checkRewardsBalance(String(args.account_id ?? ""));
    case "restore_rewards_points":
      return restoreRewardsPoints(
        String(args.account_id ?? ""),
        Number(args.correct_points ?? 0)
      );
    case "issue_perk":
      return issuePerk(
        String(args.account_id ?? ""),
        String(args.perk_type ?? "") as PerkType
      );
    case "lookup_faq":
      return lookupFaq(String(args.query ?? ""));
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function lookupFaq(query: string): Promise<ToolResult> {
  if (!query.trim()) {
    return { matches: [], message: "Empty query." };
  }
  const matches = await retrieveFaq(query, 3);
  return {
    matches: matches.map((m) => ({
      question: m.question,
      answer: m.answer,
      score: Number(m.score.toFixed(3)),
    })),
  };
}

function lookupAccount(phoneOrEmail: string): ToolResult {
  const needle = phoneOrEmail.trim().toLowerCase();
  const acct = accounts.find(
    (a) => a.email.toLowerCase() === needle || a.phone === phoneOrEmail.trim()
  );
  if (!acct) {
    return {
      error: "no_account_found",
      message:
        "No Tims Rewards account matched that identifier. Ask for a different phone or email.",
    };
  }
  return {
    account_id: acct.account_id,
    name: acct.name,
    home_store: acct.home_store,
    tier: acct.tier,
    member_since: acct.member_since,
  };
}

function checkRewardsBalance(accountId: string): ToolResult {
  const acct = accounts.find((a) => a.account_id === accountId);
  if (!acct) return { error: "account_not_found", account_id: accountId };
  return {
    visible_balance: acct.visible_balance,
    expected_balance: acct.expected_balance,
    discrepancy_flag: acct.discrepancy_flag,
    discrepancy_reason: acct.discrepancy_reason,
    last_5_transactions: acct.last_5_transactions,
  };
}

function restoreRewardsPoints(
  accountId: string,
  correctPoints: number
): ToolResult {
  const acct = accounts.find((a) => a.account_id === accountId);
  if (!acct) return { success: false, error: "account_not_found" };
  acct.visible_balance = correctPoints;
  acct.discrepancy_flag = false;
  const today = new Date().toISOString().slice(0, 10);
  const audit_log_id = `AL-${today}-${randomDigits(4)}`;
  return {
    success: true,
    new_balance: correctPoints,
    audit_log_id,
  };
}

type PerkType = "free_coffee" | "double_points_day" | "free_donut";

const PERK_INSTRUCTIONS: Record<PerkType, string> = {
  free_coffee:
    "Scan your Tims Rewards QR code at any Tim Hortons in Canada. Valid for any size brewed coffee.",
  double_points_day:
    "Earn 2x points on every purchase for one calendar day. Activates automatically on your next visit.",
  free_donut:
    "Scan your Tims Rewards QR code at the till. Valid for any classic donut.",
};

function issuePerk(accountId: string, perkType: PerkType): ToolResult {
  if (!PERK_INSTRUCTIONS[perkType]) {
    return { success: false, error: "invalid_perk_type", perk_type: perkType };
  }
  const acct = accounts.find((a) => a.account_id === accountId);
  if (!acct) return { success: false, error: "account_not_found" };
  const perk_id = `PERK-${randomAlphanum(6)}`;
  const valid_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return {
    success: true,
    perk_id,
    valid_until,
    redemption_instructions: PERK_INSTRUCTIONS[perkType],
  };
}

function randomDigits(n: number): string {
  return Math.floor(Math.random() * 10 ** n)
    .toString()
    .padStart(n, "0");
}

function randomAlphanum(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < n; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
