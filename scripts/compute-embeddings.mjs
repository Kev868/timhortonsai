// One-shot script: read data/faq.json, embed each entry's question via
// OpenAI text-embedding-3-small, write data/embeddings.json.
//
// Run with:
//   node scripts/compute-embeddings.mjs
//
// Re-run any time data/faq.json changes. Output is committed to git so the
// production build doesn't need an OpenAI key at build time.

import nextEnv from "@next/env";
import OpenAI from "openai";

const { loadEnvConfig } = nextEnv;
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
loadEnvConfig(projectRoot);

const EMBEDDING_MODEL = "text-embedding-3-small";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY in .env.local");
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

const faqPath = path.join(projectRoot, "data", "faq.json");
const outPath = path.join(projectRoot, "data", "embeddings.json");

const faq = JSON.parse(readFileSync(faqPath, "utf8"));
const entries = faq.entries;

console.log(`Embedding ${entries.length} FAQ entries via ${EMBEDDING_MODEL}...`);

const results = [];
for (const entry of entries) {
  const input = `${entry.question}\n${entry.answer}`;
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });
  const embedding = res.data[0].embedding;
  results.push({
    id: entry.id,
    category: entry.category,
    question: entry.question,
    answer: entry.answer,
    embedding,
  });
  process.stdout.write(".");
}
console.log("");

const out = {
  model: EMBEDDING_MODEL,
  dim: results[0].embedding.length,
  source: faq.source,
  generated_at: new Date().toISOString(),
  entries: results,
};

writeFileSync(outPath, JSON.stringify(out));
const sizeKb = (Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(1);
console.log(`Wrote ${outPath} (${results.length} entries, ${sizeKb} KB)`);
