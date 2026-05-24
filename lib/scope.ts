export type ScopeCheck = {
  in_scope: boolean;
  reason: string;
};

const TIMS_KEYWORDS = [
  // Brand
  "tim", "tims", "timmies", "tim hortons", "timhortons",
  // Products
  "coffee", "double-double", "double double", "timbit", "timbits", "donut",
  "doughnut", "iced cap", "iced capp", "bagel", "muffin", "wrap", "sandwich",
  "latte", "espresso", "tea", "hot chocolate", "breakfast", "lunch",
  "menu", "drink", "food", "item", "meal", "combo", "size",
  // Rewards & promotions
  "reward", "rewards", "point", "points", "perk", "perks", "redeem", "tier",
  "gold", "standard", "member", "membership", "balance",
  "roll up", "rim", "camp", "camps", "camp day",
  // Operational
  "mobile order", "drive-thru", "drive thru", "drivethrough", "pickup",
  "store", "location", "hours", "open", "close",
  "app", "account", "card", "scan", "qr", "code", "barcode",
  "refund", "order", "missing", "wrong", "complaint", "purchase", "receipt",
  // Conversational follow-ups
  "thanks", "thank you", "yes", "no", "ok", "okay", "sure", "please",
  "help", "hi", "hey", "hello", "bye", "cheers", "morning", "afternoon",
];

const OFF_TOPIC_KEYWORDS = [
  // Meta / jailbreak attempts (security-critical, always block)
  "system prompt", "your instructions", "your prompt",
  "ignore your", "ignore previous", "you are now", "developer mode",
  "jailbreak", "act as if", "respond as if",
];

function containsAnyWord(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  for (const w of words) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(lower)) return true;
  }
  return false;
}

export function fastScopeCheck(message: string): ScopeCheck {
  if (!message.trim()) {
    return { in_scope: true, reason: "Empty message." };
  }
  const hasOffTopic = containsAnyWord(message, OFF_TOPIC_KEYWORDS);
  const hasTims = containsAnyWord(message, TIMS_KEYWORDS);

  if (hasOffTopic && !hasTims) {
    return {
      in_scope: false,
      reason: "Off-topic keyword detected with no Tim Hortons context.",
    };
  }
  return { in_scope: true, reason: "In scope." };
}

export const OUT_OF_SCOPE_REFUSAL =
  "Not something I can help with from Tims Care, sorry. Just Tim Hortons stuff from me here.";
