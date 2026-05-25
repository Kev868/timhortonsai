import OpenAI from "openai";

let openaiClient: OpenAI | null = null;
let togetherClient: OpenAI | null = null;

// The agent's main chat model. Update this after fine-tuning lands.
// - OpenAI model id (no "/"): routes to OpenAI (e.g. "gpt-4o", "gpt-4o-mini")
// - Together model id (contains "/"): routes to Together AI's OpenAI-compatible
//   endpoint (e.g. "yourname/Meta-Llama-3.1-70B-Instruct-Reference-tims-xxx")
export const MODEL = "gpt-4o";

// OpenAI client. Used for embeddings (RAG) and the eval LLM-as-judge regardless
// of which chat model we route to.
export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// Together AI client (OpenAI-compatible). Used for inference on a fine-tuned
// open-source model hosted on Together's infrastructure.
export function getTogether(): OpenAI {
  if (!togetherClient) {
    togetherClient = new OpenAI({
      apiKey: process.env.TOGETHER_API_KEY,
      baseURL: "https://api.together.xyz/v1",
    });
  }
  return togetherClient;
}

// Returns the appropriate chat client based on the current MODEL constant.
// Together AI model ids always contain a slash; OpenAI ids do not.
export function getChatClient(): OpenAI {
  return MODEL.includes("/") ? getTogether() : getOpenAI();
}
