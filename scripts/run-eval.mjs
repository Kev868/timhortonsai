// Eval harness for the Tim Hortons AI Care agent.
//
// Runs ~10 scripted scenarios through the deployed agent, scores each on
// tool-call accuracy and brand-voice adherence (LLM-as-judge), and prints
// a scorecard. Use this to compare base prompt vs +RAG vs fine-tuned model.
//
// Run with:
//   npm run eval
//
// Override target:
//   EVAL_URL=https://timhortonsaiproject.vercel.app npm run eval
//   EVAL_URL=http://localhost:3000 npm run eval

import nextEnv from "@next/env";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { loadEnvConfig } = nextEnv;
loadEnvConfig(projectRoot);

const TARGET_URL = process.env.EVAL_URL || "https://timhortonsaiproject.vercel.app";
const JUDGE_MODEL = "gpt-4o-mini";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY in .env.local");
  process.exit(1);
}
const openai = new OpenAI({ apiKey });

// ---- Scenarios -----------------------------------------------------------

const SCENARIOS = [
  {
    id: "sarah-golden-path",
    name: "Sarah's full rewards-fix flow",
    messages: [
      {
        role: "user",
        content:
          "Hey, just placed a mobile order at Bloor and Yonge and my Tims Rewards is showing 0 points. I had 850 yesterday. My email is sarah.chen@gmail.com.",
      },
    ],
    expected_tools: [
      "lookup_account",
      "check_rewards_balance",
      "restore_rewards_points",
      "issue_perk",
    ],
    voice_rules: [
      "Opens with a brief warm acknowledgement of the problem (e.g. 'Oh no...').",
      "Uses Sarah's first name once she's been looked up.",
      "Mentions the points were restored to 850 (or equivalent restored figure).",
      "Frames the free coffee as a gesture given for the trouble, not something earned.",
      "Does NOT use the word 'inconvenience'.",
      "Does NOT contain any emoji.",
      "Does NOT close with 'is there anything else I can help with' or any paraphrase of that pattern.",
    ],
  },
  {
    id: "direct-balance-check",
    name: "Direct balance check (no fix needed)",
    messages: [
      {
        role: "user",
        content:
          "Can you check the points balance on my account please? My email is sarah.chen@gmail.com",
      },
    ],
    expected_tools: ["lookup_account", "check_rewards_balance"],
    voice_rules: [
      "Reports the visible balance clearly.",
      "Mentions the discrepancy (visible vs expected) if one exists.",
      "Voice is conversational, not formal database-readout.",
      "Does NOT contain any emoji.",
    ],
  },
  {
    id: "faq-rewards-overview",
    name: "FAQ: how does Tims Rewards work",
    messages: [{ role: "user", content: "How does Tims Rewards work?" }],
    expected_tools: ["lookup_faq"],
    voice_rules: [
      "Explains the rewards program in plain language.",
      "Mentions earning points and redeeming for menu items.",
      "Does NOT contain any emoji.",
      "Does NOT close with 'let me know if you have any other questions' or similar canned close.",
    ],
  },
  {
    id: "faq-gluten-free",
    name: "FAQ: gluten-free donuts",
    messages: [
      { role: "user", content: "Do you have gluten-free donuts?" },
    ],
    expected_tools: ["lookup_faq"],
    voice_rules: [
      "Honestly states that Tim Hortons doesn't have certified gluten-free baked goods.",
      "Mentions cross-contact in shared kitchens as the reason.",
      "Does NOT contain any emoji.",
    ],
  },
  {
    id: "faq-store-hours",
    name: "FAQ: store hours policy",
    messages: [
      { role: "user", content: "Are all Tim Hortons open 24 hours?" },
    ],
    expected_tools: ["lookup_faq"],
    voice_rules: [
      "Clearly says not all locations are 24 hours.",
      "Suggests checking the Tims app or website for specific hours.",
      "Does NOT contain any emoji.",
    ],
  },
  {
    id: "unknown-identifier",
    name: "Unknown email lookup (no hallucination)",
    messages: [
      {
        role: "user",
        content:
          "My points are missing. My email is definitely-not-a-real-account-12345@example.com",
      },
    ],
    expected_tools: ["lookup_account"],
    voice_rules: [
      "Says it couldn't find an account with that identifier.",
      "Asks for a different phone or email.",
      "Does NOT invent account information.",
      "Does NOT contain any emoji.",
    ],
  },
  {
    id: "perk-swap-anti-hallucination",
    name: "Perk swap (anti-hallucination)",
    messages: [
      {
        role: "user",
        content:
          "My Tims Rewards is showing 0 points but should be 850. Email is sarah.chen@gmail.com",
      },
      {
        role: "agent",
        content:
          "Oh no, let me take a look for ya. Bear with me a sec. Found it, Sarah. Looks like your points took a little detour through Calgary, eh? All sorted, 850 points back where they belong. Also throwing a free coffee your way for the trouble. Enjoy!",
      },
      {
        role: "user",
        content:
          "actually wait, can you do double points day instead of the free coffee?",
      },
    ],
    expected_tools: [],
    voice_rules: [
      "Does NOT claim to have swapped or revoked the free coffee.",
      "Honestly says it can't take back a perk that's already been issued.",
      "Offers to add the double points day on top as an alternative (asks for confirmation).",
      "Does NOT contain any emoji.",
    ],
  },
  {
    id: "casual-followup",
    name: "Casual follow-up voice consistency",
    messages: [
      {
        role: "user",
        content:
          "My Tims Rewards is showing 0 points but should be 850. Email is sarah.chen@gmail.com",
      },
      {
        role: "agent",
        content:
          "Oh no, let me take a look for ya. Bear with me a sec. Found it, Sarah. Looks like your points took a little detour through Calgary, eh? All sorted, 850 points back where they belong. Also throwing a free coffee your way for the trouble. Enjoy!",
      },
      { role: "user", content: "thanks! one more thing, when did I join Tims Rewards?" },
    ],
    expected_tools: ["lookup_account"],
    voice_rules: [
      "Gives the join date.",
      "Voice remains conversational (not 'You have been a Tims Rewards member since...').",
      "Does NOT close with any paraphrase of 'is there anything else I can help with'.",
      "Does NOT contain any emoji.",
    ],
  },
  {
    id: "off-topic",
    name: "Off-topic question",
    messages: [
      { role: "user", content: "What's the weather like in Toronto today?" },
    ],
    expected_tools: [],
    voice_rules: [
      "Politely declines to answer (out of scope).",
      "Redirects to a Tim Hortons-related thing if natural, or just acknowledges the limit.",
      "Does NOT make up weather info.",
      "Does NOT contain any emoji.",
    ],
  },
  {
    id: "refund-cannot-do",
    name: "Refund request (action it can't do)",
    messages: [
      {
        role: "user",
        content:
          "I want a refund on the mobile order I just placed, it was wrong",
      },
    ],
    expected_tools: ["lookup_faq"],
    voice_rules: [
      "Honestly explains refunds for mobile orders go through the store, not chat.",
      "Offers to issue a goodwill perk on the rewards account as an alternative.",
      "Does NOT claim to have processed a refund.",
      "Does NOT contain any emoji.",
    ],
  },
];

// ---- Agent driver --------------------------------------------------------

async function runAgent(messages) {
  const res = await fetch(`${TARGET_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Agent request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const tools = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        const ev = JSON.parse(t);
        if (ev.type === "text_delta") text += ev.text;
        else if (ev.type === "tool_call_start") tools.push(ev.name);
      } catch {
        // skip parse failures
      }
    }
  }
  return { text, tools };
}

// ---- Scoring -------------------------------------------------------------

function scoreTools(expected, actual) {
  if (expected.length === 0) {
    return { score: actual.length === 0 ? 1 : 0.5, detail: `expected none, got ${actual.length}` };
  }
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const matched = expected.filter((t) => actualSet.has(t)).length;
  return {
    score: matched / expected.length,
    detail: `${matched}/${expected.length} matched (extras: ${[...actualSet].filter((t) => !expectedSet.has(t)).join(",") || "none"})`,
  };
}

async function judgeVoice(agentText, voiceRules) {
  const prompt = `You are evaluating a customer service agent response against a list of brand voice rules.

Voice rules to check (each rule, pass or fail):
${voiceRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Agent response to evaluate:
"""
${agentText}
"""

For each rule, decide pass or fail. Then return JSON in this exact shape:
{
  "rules": [
    {"rule": "<rule text>", "pass": true|false, "reason": "<one-line reason>"}
  ],
  "score": <float 0.0 to 1.0, = passed_rules / total_rules>
}

Be strict: only mark pass if the rule is clearly met.`;

  const res = await openai.chat.completions.create({
    model: JUDGE_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(res.choices[0].message.content);
  return parsed;
}

// ---- Runner --------------------------------------------------------------

console.log(`\nRunning eval against ${TARGET_URL}`);
console.log("=".repeat(72));

const results = [];

for (let i = 0; i < SCENARIOS.length; i++) {
  const sc = SCENARIOS[i];
  process.stdout.write(`[${i + 1}/${SCENARIOS.length}] ${sc.name} ... `);

  let agentResult;
  try {
    agentResult = await runAgent(sc.messages);
  } catch (err) {
    console.log(`ERROR (${err.message})`);
    results.push({ id: sc.id, name: sc.name, error: err.message });
    continue;
  }

  const toolScore = scoreTools(sc.expected_tools, agentResult.tools);
  const voiceJudgment = await judgeVoice(agentResult.text, sc.voice_rules);

  const pass = toolScore.score === 1 && voiceJudgment.score >= 0.8;
  console.log(pass ? "PASS" : "FAIL");
  console.log(`        tools: ${toolScore.detail}`);
  console.log(`        voice: ${voiceJudgment.score.toFixed(2)} (${voiceJudgment.rules.filter((r) => !r.pass).length} rule(s) failed)`);
  for (const r of voiceJudgment.rules.filter((r) => !r.pass)) {
    console.log(`          - FAILED: ${r.rule}`);
    console.log(`            reason: ${r.reason}`);
  }

  results.push({
    id: sc.id,
    name: sc.name,
    tools_called: agentResult.tools,
    tools_expected: sc.expected_tools,
    tool_score: toolScore.score,
    voice_score: voiceJudgment.score,
    pass,
  });
}

console.log("\n" + "=".repeat(72));
console.log("SUMMARY");
const succeeded = results.filter((r) => !r.error);
const passed = succeeded.filter((r) => r.pass).length;
const avgTool = succeeded.reduce((s, r) => s + r.tool_score, 0) / succeeded.length;
const avgVoice = succeeded.reduce((s, r) => s + r.voice_score, 0) / succeeded.length;
console.log(`  Tool accuracy:  ${(avgTool * 100).toFixed(0)}% avg`);
console.log(`  Voice score:    ${avgVoice.toFixed(2)} avg`);
console.log(`  Pass rate:      ${passed}/${succeeded.length} (${((passed / succeeded.length) * 100).toFixed(0)}%)`);
console.log("=".repeat(72));
