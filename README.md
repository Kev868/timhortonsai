# Tim Hortons AI Customer Care

> One-line pitch (write this last, after the whole README is drafted). Aim for "a Sierra-style customer service agent for Tim Hortons that takes multi-step action in brand voice, not just answers FAQs."

**Live demo:** https://timhortonsaiproject.vercel.app/
**Repo:** https://github.com/Kev868/timhortonsai

---

## What it does

A 60-second walk-through, in customer voice:

1. Customer says "my Tims Rewards is showing 0 points, was at 850. email is sarah.chen@gmail.com"
2. Agent acknowledges in brand voice ("Oh no, let me take a look for ya. Bear with me a sec.")
3. Agent calls four tools in sequence: `lookup_account` → `check_rewards_balance` → `restore_rewards_points` → `issue_perk`
4. Agent reports the fix back in voice ("Found it, Sarah. Looks like your points took a little detour through Calgary, eh? All sorted, 850 back where they belong. Also throwing a free coffee your way for the trouble. Enjoy.")

The differentiator isn't the FAQ lookup — it's that the agent **takes action** on the customer's behalf, in a voice that's recognizably Tim Hortons.

*(Suggested: drop in a screenshot or a short GIF of the chat flow here.)*

---

## Architecture

```
Browser (Next.js 16 + Tailwind v4)
    │
    │  POST /api/chat  (NDJSON event stream)
    ▼
app/api/chat/route.ts
    │
    ├── lib/scope.ts        ← local keyword classifier (jailbreak gate)
    │
    └── Agent loop:
        ├── lib/system-prompt.ts   ← iterated voice + tool policy
        ├── lib/tools.ts           ← 4 mock customer-service tools + lookup_faq
        ├── lib/rag.ts             ← cosine similarity over text-embedding-3-small
        └── lib/openai.ts          ← routes to OpenAI (gpt-4o) OR Together (fine-tuned Llama 70B)
```

Streaming protocol is NDJSON over `fetch` — one event per line: `text_delta`, `tool_call_start`, `tool_call_end`, `done`. Client renders agent messages and inline trace lines as the events arrive.

---

## Why these technical choices

*(This is the highest-leverage section. Spend the most words here, in your voice.)*

**No LangChain / no Pinecone / no Vercel AI SDK.** Wrote the agent loop, streaming protocol, and RAG by hand. ~80 lines for the RAG layer, ~150 for the agent loop. *Why:* frameworks abstract away the reliability behaviors I want to control (retries, tool-call validation, voice consistency).

**Custom RAG over a curated corpus.**
- 25 hand-curated FAQ entries (rewards, mobile orders, menu, store policies) → embedded once via `text-embedding-3-small` → cosine similarity at query time.
- Why not scrape tims.ca/help? Tried — it's a JavaScript SPA that needs a headless browser to scrape. The RAG plumbing is the technical content; the data source is interchangeable.

**Iterated system prompt to 100% eval pass rate, *then* fine-tuned.**
- The prompt iteration alone got 10/10 on the eval harness. Most candidates would have stopped there.
- I fine-tuned anyway because (a) it distills the prompt patterns into a smaller cheaper model and (b) reduces run-to-run variance.

**Fine-tuned Llama-3.1-70B-Instruct via LoRA on Together AI — instructive failure.**
- 25 multi-turn examples covering Sarah's golden path, balance checks, FAQ retrieval, refund/perk-swap flows, off-topic refusals.
- LoRA rank 64, alpha 128, 3 epochs, batch size 8, learning rate 1e-5, cosine LR schedule. Training ran 28 min, cost $4 on Together.
- **Discovered at inference time:** the fine-tuned model emits tool calls as raw JSON text strings rather than invoking them as structured `tool_calls`. Root cause: our dataset stored tool calls in OpenAI's JSON format, and Llama-3.1 learned to literally output that JSON as text content. Llama uses `<|python_tag|>` tokens for native function calling, which is incompatible with the OpenAI tool-call format we trained on.
- *Honest call:* shipped gpt-4o in production. The fine-tuning artifact is on Together (`lingfengge72_ec1b/Meta-Llama-3.1-70B-Instruct-Reference-tims-e6a26d7a`) and the training script + dataset are reproducible from this repo. For a real production deploy, the fix is to reformat the JSONL into Llama's native tool-calling format before fine-tuning, then re-evaluate.
- *Also worth knowing:* originally targeted OpenAI fine-tuning — they're sunsetting self-serve mid-2026. Pivoted to Together. The pivot is itself a signal: the platform landscape shifts fast.

**LLM-as-judge eval harness.**
- 10 scripted scenarios, each with `expected_tools` and a list of voice rules.
- Per scenario: agent runs against production URL, tool calls are checked against expected set, response text is scored by `gpt-4o-mini` against the rules.
- Output is a single-command scorecard: `npm run eval`.

**Pre-flight scope check.**
- Local keyword classifier (microseconds, no API call) catches obvious jailbreak attempts before the agent loop runs.
- System prompt has a HARD RULE for topic scope as defense-in-depth.

---

## Eval results

*(Add the actual numbers once you have the fine-tuned model evaluated.)*

| Configuration | Tool accuracy | Voice score | Pass rate |
|---|---|---|---|
| Iterated prompt + RAG + gpt-4o (in production) | **100%** | **1.00** | **10/10** |
| Fine-tuned Llama-3.1-70B (LoRA) | 0% (tool-format mismatch) | n/a | 0/10 |

*(One paragraph in your voice: what the fine-tune experiment surfaced — the Llama-vs-OpenAI tool-format incompatibility — and why that's actually a more useful finding than a clean comparison number would have been. Keep this honest. The fact that you ran the experiment, hit the gotcha, diagnosed it, and made a real production call beats any synthetic "fine-tuned X% better" number you could have manufactured.)*

---

## What I'd build next

*(Keep this tight. 4-6 bullets.)*

- Hybrid retrieval (BM25 + dense + reciprocal rank fusion) to catch literal-term queries the cosine-only retriever misses.
- Self-critique loop: agent reviews its own response against the system prompt before sending, regenerates if it violates a rule.
- Cross-conversation memory (per-customer): summarize past interactions, retrieve relevant context for repeat customers.
- Structured outputs with Zod schemas on every tool result, with retry-on-schema-failure.
- Real eval on production traffic, not just scripted scenarios.

---

## Stack

- Next.js 16.2 (App Router) · React 19 · TypeScript · Tailwind v4
- OpenAI: `gpt-4o` for the agent loop (production), `text-embedding-3-small` for embeddings, `gpt-4o-mini` as eval judge
- Together AI: Llama-3.1-70B-Instruct fine-tuned via LoRA (training artifact, not in production — see "Why these technical choices" for why)
- Deployed on Vercel

---

## Running it locally

```bash
git clone https://github.com/Kev868/timhortonsai
cd timhortonsai
npm install
# add OPENAI_API_KEY and TOGETHER_API_KEY to .env.local
npm run dev
```

Eval harness:
```bash
npm run eval
```

Regenerate embeddings (after editing `data/faq.json`):
```bash
npm run embeddings
```

Build the fine-tuning dataset + submit job:
```bash
npm run build-dataset
npm run fine-tune    # requires TOGETHER_API_KEY
```

---

*(Optional: short "about the build" footer in your own voice — Waterloo EE undergrad, weekend project, etc. Keep it brief and don't apologize for anything.)*
