# Tim Hortons AI Agent — Project Handoff

## Mission

Build a polished, Sierra-style AI customer service agent for Tim Hortons by Sunday night, May 24, 2026. This is a cold outreach demo for Clay Bavor, co-founder of Sierra (sierra.ai), reacting to Sierra's recent Toronto office opening.

The thesis we are proving: **a competent AI agent doesn't just answer questions, it takes multi-step action on the customer's behalf in a way that feels recognizably Tim Hortons.** Brand voice fidelity and visible tool-calling are the two differentiators. Everything else is supporting infrastructure.

## Hard Deadline

Sunday, May 24, 2026, end of day. Deploy by 8pm Eastern.

## Tech Stack (locked — do not propose alternatives)

- Next.js 15 with App Router, TypeScript, Tailwind CSS
- OpenAI API: `gpt-4o` for the agent loop, `text-embedding-3-small` for RAG
- RAG approach: scrape Tim Hortons help center → chunk → embed once → save to local JSON → cosine similarity at query time. **No vector DB, no LangChain, no Pinecone, no fancy frameworks.** 80 lines of code max for the RAG layer.
- OpenAI native function calling for tool use
- Vercel for deployment
- No voice. No authentication. No real backend. All tool implementations are mocked with believable JSON.

## Current State (already done by user)

- Project scaffolded at `C:\Users\lingf\Downloads\Projects - VSCODE\timhortonsaiproject`
- Default Next.js 15 boilerplate with App Router, TypeScript, Tailwind
- `npm install openai` already run
- Dev server confirmed working: `npm run dev` → `http://localhost:3000` loads default welcome page
- User has an OpenAI API key (starts with `sk-proj-`) ready to add to `.env.local`
- `.env.local` does NOT yet exist; create it as Phase 1 step 1

## The Demo Scenario (the spine — every code decision serves this)

**Setup:** A customer named Sarah Chen just placed a mobile order in Toronto. Her Tims Rewards points show 0 in the app, but yesterday she had 850 points and was planning to redeem a free coffee. She is mildly annoyed and confused.

**The agent's job:**

1. Acknowledge her frustration with brand-voice warmth (NOT generic "I apologize for the inconvenience")
2. Call `lookup_account` to find her record
3. Call `check_rewards_balance` to see current state plus recent transactions
4. Diagnose internally: a recent purchase in Calgary triggered a regional sync bug that zeroed her visible balance
5. Call `restore_rewards_points` to correct the balance back to 850
6. Call `issue_perk` to grant a free coffee on her next visit as a goodwill gesture
7. Confirm everything in Tim Hortons voice and close the loop

This scenario demonstrates: multi-step reasoning, four tool calls, empathy modeling, action-taking (not FAQ lookup), and brand voice opportunity.

## The Four Tools (mock implementations, but believable)

```typescript
// 1. lookup_account
{
  name: "lookup_account",
  description: "Look up a customer's Tim Hortons Rewards account by phone or email",
  parameters: {
    phone_or_email: string  // e.g. "sarah.chen@gmail.com" or "+14165551234"
  },
  returns: {
    account_id: string,           // e.g. "A4F2B1"
    name: string,                 // "Sarah Chen"
    home_store: string,           // "Tim Hortons #1247, Bloor & Yonge, Toronto"
    tier: "Standard" | "Gold",
    member_since: string          // ISO date
  }
}

// 2. check_rewards_balance
{
  name: "check_rewards_balance",
  description: "Get the current visible balance and last 5 transactions for an account",
  parameters: {
    account_id: string
  },
  returns: {
    visible_balance: number,
    last_5_transactions: Array<{
      date: string,
      location: string,
      amount: number,
      points_earned: number,
      points_balance_after: number
    }>,
    discrepancy_flag: boolean,
    expected_balance: number      // The system-of-truth balance
  }
}
// CRITICAL: For Sarah's account, visible_balance returns 0, but expected_balance
// returns 850, with a discrepancy_flag of true. The last_5_transactions show
// a Calgary purchase 2 days ago that triggered the regional sync bug.

// 3. restore_rewards_points
{
  name: "restore_rewards_points",
  description: "Restore a customer's rewards balance to its correct value (used to fix sync bugs)",
  parameters: {
    account_id: string,
    correct_points: number
  },
  returns: {
    success: boolean,
    new_balance: number,
    audit_log_id: string  // e.g. "AL-2026-05-22-7891"
  }
}

// 4. issue_perk
{
  name: "issue_perk",
  description: "Grant a goodwill perk to a customer (free coffee, double points day, free donut)",
  parameters: {
    account_id: string,
    perk_type: "free_coffee" | "double_points_day" | "free_donut"
  },
  returns: {
    success: boolean,
    perk_id: string,             // e.g. "PERK-7B2A91"
    valid_until: string,         // ISO date, ~30 days out
    redemption_instructions: string
  }
}
```

## Brand Guidelines: Tim Hortons

**Visual identity (match the real brand):**

- Primary red: `#C8102E` (the actual Tim Hortons red)
- Secondary brown: `#5C2E13` for warm accents
- Cream background: `#FBF4E8` for warmth
- Off-white surface: `#FFFFFF` for cards/messages
- Tims red is dominant, used sparingly for emphasis and CTAs, NOT the chat background

**Typography:**

- Do NOT use Inter, Roboto, or system defaults. Those signal generic AI demo.
- Body font suggestion: `Source Sans Pro` or `Source Sans 3` (close to Tim Hortons' real brand voice)
- Display font for headers: `Sherbrook` (Tim's official, may not be available) → fallback to `Source Serif Pro` or a warm serif
- If using Google Fonts, import them properly in `app/layout.tsx`

**Voice — this is the heart of the demo, iterate hard:**

The agent must sound like Tim Hortons, not like ChatGPT cosplaying Tim Hortons. Tone is warm, slightly self-deprecating, recognizably Canadian, comfortable.

✅ Right voice examples:
- "Oh no, the Tims app is acting up again, eh? Let me have a look for ya."
- "Found it, Sarah. Looks like your points took a little detour through Calgary."
- "All sorted — 850 points back where they belong. Also throwing a free coffee your way for the trouble. Sound good?"

❌ Wrong voice examples:
- "I apologize for the inconvenience. I will investigate this matter."
- "I have processed your request. Is there anything else I can help you with today?"
- "I understand your frustration. Let me look into that for you right away."

The wrong examples are generic corporate AI. The right examples have Canadian warmth without being parody. Aim for "Tim's employee who's been there 8 years" not "Canadian stereotype."

**Voice rules:**
- "Ya" or "eh" max twice per conversation. Sprinkle, don't pile on.
- Say "the Tims app" not "our app"
- Can lightly acknowledge bugs without going corporate
- Use "Sarah" by name, not "ma'am" or "the customer"
- Never use the word "inconvenience"

## Architecture / File Structure

```
timhortonsaiproject/
├── app/
│   ├── page.tsx                  # Main chat page
│   ├── layout.tsx                # Root layout with fonts
│   ├── globals.css               # Tailwind + Tim Hortons CSS vars
│   └── api/
│       └── chat/
│           └── route.ts          # Streaming chat endpoint, function calling loop
├── lib/
│   ├── openai.ts                 # OpenAI client setup
│   ├── tools.ts                  # Tool schemas + mock implementations
│   ├── rag.ts                    # RAG: load embeddings, retrieve by cosine
│   └── system-prompt.ts          # Tim Hortons agent system prompt (iterate often)
├── components/
│   ├── ChatContainer.tsx         # Main chat UI
│   ├── Message.tsx               # Individual message bubble
│   ├── ToolCallCard.tsx          # CRITICAL: visualizes tool calls
│   ├── ToolCallSidebar.tsx       # OR sidebar variant
│   └── BrandHeader.tsx           # Tim Hortons branded header
├── data/
│   ├── embeddings.json           # Pre-computed FAQ embeddings (Saturday)
│   ├── mock-accounts.json        # Mock customer data including Sarah Chen
│   └── faq-scraped/              # Raw scraped FAQ pages (Saturday)
├── scripts/
│   ├── scrape-faq.ts             # One-shot scraper for tims.ca/help
│   └── compute-embeddings.ts     # One-shot embeddings generation
├── reference/                    # User-provided brand screenshots (read-only)
└── .env.local                    # OPENAI_API_KEY=sk-proj-... (gitignored)
```

## Build Phases

### Phase 1: UI Shell (Friday evening, ~4 hours) ← START HERE

Goal: localhost:3000 looks distinctly like Tim Hortons made it, with 2-3 hardcoded sample messages. No LLM yet.

Steps:
1. Create `.env.local` with placeholder for OPENAI_API_KEY (instruct user to paste their key)
2. Set up Tailwind config with Tim Hortons brand tokens (CSS variables in globals.css)
3. Configure Google Fonts (Source Sans Pro + Source Serif Pro or chosen alternatives)
4. Build `BrandHeader.tsx` with Tim Hortons logo treatment (text or simple SVG, no copyrighted assets)
5. Build `Message.tsx` with distinct styles for user vs agent
6. Build `ChatContainer.tsx` with hardcoded sample conversation
7. Replace default `app/page.tsx` with the new layout
8. Verify on localhost:3000 — should look like a Tim Hortons product, not a generic chatbot

Commit at end of Phase 1: `git commit -am "Phase 1 complete: branded UI shell"`

### Phase 2: Agent Brain (Saturday, ~8-10 hours)

Goal: end-to-end scenario works. Sarah's message → 4 tool calls → resolution. Brand voice is recognizable.

Steps:
1. Implement `lib/openai.ts` with OpenAI client wrapper
2. Write first draft of `lib/system-prompt.ts` (will iterate)
3. Define the four tools in `lib/tools.ts` with mock implementations
4. Build `app/api/chat/route.ts` with streaming + function calling loop
5. Wire `ChatContainer` to the API endpoint
6. Build `ToolCallCard.tsx` to visualize each tool invocation
7. Scrape Tim Hortons FAQ pages (`scripts/scrape-faq.ts`)
8. Embed and save (`scripts/compute-embeddings.ts`)
9. Implement `lib/rag.ts` with cosine similarity retrieval
10. Iterate on system prompt until brand voice lands (expect 5-10 rounds)

Commit at end of Phase 2: `git commit -am "Phase 2 complete: agent works end-to-end"`

### Phase 3: Polish & Ship (Sunday, ~6 hours)

Goal: a link that looks like a real product, ready to send to Clay Bavor.

Steps:
1. Brand fidelity pass: open user's reference screenshots, pixel-match where reasonable
2. Add loading states, smooth transitions, subtle animations
3. Make `ToolCallCard` beautiful — this is the "wow" moment
4. Record 60-second demo video walking through the scenario
5. Deploy to Vercel (`vercel --prod`)
6. Final smoke test on deployed URL
7. Final git commit: `git commit -am "Phase 3 complete: shipped"`

## Quality Bar (anti-slop measures — strictly enforced)

This demo must NOT look AI-generated. Specifically avoid:

1. **No generic AI assistant patterns.** No 🤖 emoji, no "Hello! I am an AI assistant designed to help you..." greetings, no purple gradient backgrounds, no three-dot typing indicators that look like ChatGPT.
2. **No Inter, no Roboto, no system fonts as primary.** They scream "default template."
3. **No purple-gradient-on-white** anywhere. That's the AI-app cliché of 2025-2026.
4. **No unused imports, no dead code, no leftover `// TODO` or `// FIXME` comments** in shipped files.
5. **No filler comments.** "// initialize state" and "// handle the click" are AI smell. Comments should explain *why*, not *what*.
6. **No AI-written README.** If there's a README, the user writes it (or leave it empty).
7. **Tool calls MUST be visible in the UI.** A sidebar or inline cards showing "Agent called `lookup_account('sarah.chen@gmail.com')` → returned `account_id: A4F2B1`". This is the single most powerful "this person knows what they're doing" signal in the demo.
8. **Brand voice must be iterated.** The first system prompt draft will be too generic. Plan for 5-10 rewrites. The user should review every iteration.
9. **Match implementation complexity to the aesthetic.** Tim Hortons is warm and unpretentious, not maximalist. The UI should feel comfortable and intentional, not flashy.

## Out of Scope (do not build)

- Authentication / user accounts
- Real backend integrations
- Voice or phone support
- Multi-channel (just chat, single-thread)
- Email integration
- Real Tim Hortons API calls (everything mocked)
- Internationalization
- Dark mode (Tim Hortons is warm and bright, dark mode is wrong here)
- Per-token streaming animations (basic streaming is fine, fancy per-token is a time sink)
- Eval harness
- Unit tests (no time; user can explain to interviewer that production-ready would include them)
- Any feature not explicitly listed in the four tools

## Interaction Style With User

The user (K) is an Electrical Engineering student at the University of Waterloo. Solid React/TypeScript experience, limited LLM/agent experience. He is intentionally using AI assistance and wants to ship by Sunday night.

- Be specific and concrete. He prefers numbered steps and explicit commands.
- He has asked for slower pacing — one step at a time, wait for confirmation before proceeding.
- He values critical feedback. Do not sugarcoat.
- **He prefers no em dashes in any text output.** Use commas, periods, or parentheses instead.
- Commit to git frequently with descriptive messages. He may not remember to.
- Strategic questions (scenario design, brand voice, demo video script, cold outreach) are being handled in a parallel conversation. Defer those.

## First Task

Do NOT immediately start writing code. Instead:

1. Confirm you've read this file by listing the four tool names and one sentence about the scenario
2. Run `ls` to verify project state matches "Current State" above
3. Create `.env.local` with content `OPENAI_API_KEY=` and instruct the user to paste their key after the equals sign
4. Propose the Phase 1 file structure (which files you'll create or modify)
5. Wait for user approval before generating any code

This handshake ensures we start aligned.

## Useful Commands

- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Deploy: `vercel --prod` (after `npm install -g vercel && vercel login`)
- Git checkpoint: `git add -A && git commit -m "checkpoint: <what you just did>"`
