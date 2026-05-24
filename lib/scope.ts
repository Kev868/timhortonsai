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
  "latte", "espresso", "tea", "hot chocolate", "breakfast",
  // Rewards
  "reward", "rewards", "point", "points", "perk", "perks", "redeem", "tier",
  "gold", "standard", "member", "membership", "balance",
  // Operational
  "mobile order", "drive-thru", "drive thru", "store", "location", "hours",
  "app", "account", "card", "scan", "qr", "refund", "order", "missing",
  "wrong", "complaint", "purchase",
  // Conversational follow-ups
  "thanks", "thank you", "yes", "no", "ok", "okay", "sure", "please",
  "help", "hi", "hey", "hello", "bye", "cheers",
];

const OFF_TOPIC_KEYWORDS = [
  // Weather / news / events
  "weather", "temperature", "rain", "snow", "forecast", "humidity",
  "news", "politics", "election", "stock", "stocks", "crypto", "bitcoin",
  // Sports
  "hockey", "basketball", "soccer", "football", "baseball", "raptors", "leafs",
  // Other food brands
  "starbucks", "mcdonald", "mcdonalds", "wendy", "subway", "dunkin",
  "burger king", "chipotle", "popeyes", "kfc",
  // Generic non-Tims tasks
  "joke", "poem", "story", "song", "rap", "lyrics",
  "code", "coding", "programming", "javascript", "python", "typescript",
  "math", "calculate", "equation", "algebra", "calculus",
  "homework", "essay", "translation", "translate",
  // Meta / jailbreak
  "system prompt", "your instructions", "your prompt", "ignore your",
  "ignore previous", "you are now", "developer mode", "jailbreak",
  "pretend you", "roleplay", "role-play", "role play", "hypothetical",
  "imagine you", "act as", "respond as if",
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
