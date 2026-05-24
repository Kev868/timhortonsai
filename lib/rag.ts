import embeddingsData from "@/data/embeddings.json";
import { getOpenAI } from "./openai";

const EMBEDDING_MODEL = "text-embedding-3-small";

type Entry = {
  id: string;
  category: string;
  question: string;
  answer: string;
  embedding: number[];
};

const entries = (embeddingsData as { entries: Entry[] }).entries;

export type RetrievedMatch = {
  id: string;
  question: string;
  answer: string;
  score: number;
};

export async function retrieveFaq(
  query: string,
  k = 3
): Promise<RetrievedMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const queryEmbedding = await embedQuery(trimmed);

  const scored = entries.map((e) => ({
    id: e.id,
    question: e.question,
    answer: e.answer,
    score: cosine(queryEmbedding, e.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

async function embedQuery(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
