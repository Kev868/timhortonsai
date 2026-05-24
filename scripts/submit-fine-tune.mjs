// Uploads data/fine-tune-dataset.jsonl to Together AI, creates a fine-tuning
// job on Llama-3.1-70B-Instruct, prints the job ID, and polls status until
// done. Together's REST API is hit directly via fetch — no SDK dep.
//
// Setup before running:
//   1. Sign up at together.ai (new accounts get free credit).
//   2. Get your API key from the dashboard.
//   3. Add to .env.local: TOGETHER_API_KEY=your_key_here
//
// Run with:
//   npm run fine-tune
//
// When the job completes the script prints the fine-tuned model id, which
// looks like "yourname/Meta-Llama-3.1-70B-Instruct-Reference-tims-abc123".
// Paste that into lib/openai.ts as the MODEL constant, push, redeploy.

import nextEnv from "@next/env";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { loadEnvConfig } = nextEnv;
loadEnvConfig(projectRoot);

const TOGETHER_BASE = "https://api.together.xyz/v1";
const BASE_MODEL = "meta-llama/Meta-Llama-3.1-70B-Instruct-Reference";
const N_EPOCHS = 3;
const SUFFIX = "tims";

const datasetPath = path.join(projectRoot, "data", "fine-tune-dataset.jsonl");

const apiKey = process.env.TOGETHER_API_KEY;
if (!apiKey) {
  console.error(
    "Missing TOGETHER_API_KEY in .env.local. Get a key at https://together.ai → Settings → API keys."
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
};

// ---- Upload dataset ------------------------------------------------------

const fileSize = statSync(datasetPath).size;
console.log(
  `Uploading ${datasetPath} (${(fileSize / 1024).toFixed(1)} KB) to Together...`
);

const formData = new FormData();
formData.append("purpose", "fine-tune");
const fileBlob = await fileToBlob(datasetPath);
formData.append("file", fileBlob, "fine-tune-dataset.jsonl");

const uploadRes = await fetch(`${TOGETHER_BASE}/files`, {
  method: "POST",
  headers,
  body: formData,
});

if (!uploadRes.ok) {
  console.error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
  console.error(await uploadRes.text());
  process.exit(1);
}

const uploadJson = await uploadRes.json();
const fileId = uploadJson.id;
console.log(`  file_id: ${fileId}`);

// ---- Create fine-tune job ------------------------------------------------

console.log(`Creating fine-tune job on base model ${BASE_MODEL}...`);
const jobRes = await fetch(`${TOGETHER_BASE}/fine-tunes`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    training_file: fileId,
    model: BASE_MODEL,
    n_epochs: N_EPOCHS,
    suffix: SUFFIX,
  }),
});

if (!jobRes.ok) {
  console.error(`Job creation failed: ${jobRes.status} ${jobRes.statusText}`);
  console.error(await jobRes.text());
  process.exit(1);
}

const job = await jobRes.json();
const jobId = job.id;
console.log(`  job_id: ${jobId}`);
console.log(`  status: ${job.status}`);
console.log("");
console.log("Job submitted. Training typically takes 30-90 min on 70B.");
console.log(`Monitor at: https://api.together.ai/jobs/${jobId}`);
console.log("");
console.log("Polling every 30s (Ctrl-C to exit; job continues regardless)...");

// ---- Poll ----------------------------------------------------------------

let last = job.status;
let cycles = 0;
while (true) {
  await new Promise((r) => setTimeout(r, 30000));
  cycles++;
  const statusRes = await fetch(`${TOGETHER_BASE}/fine-tunes/${jobId}`, {
    headers,
  });
  if (!statusRes.ok) {
    console.log(`  [poll error: ${statusRes.status}]`);
    continue;
  }
  const j = await statusRes.json();
  if (j.status !== last) {
    console.log(
      `  [${new Date().toISOString().slice(11, 19)}] status: ${last} -> ${j.status}`
    );
    last = j.status;
  } else if (cycles % 10 === 0) {
    console.log(
      `  [${new Date().toISOString().slice(11, 19)}] still ${j.status} (${cycles * 30}s elapsed)`
    );
  }
  if (j.status === "completed" || j.status === "succeeded") {
    console.log("");
    console.log("===========================================================");
    console.log("Training succeeded.");
    const modelName = j.output_name || j.fine_tuned_model || j.model_output_name;
    console.log(`  model id: ${modelName}`);
    console.log("");
    console.log("Next: update lib/openai.ts:");
    console.log(`  export const MODEL = "${modelName}";`);
    console.log("Then git commit + git push to redeploy.");
    console.log("===========================================================");
    break;
  }
  if (j.status === "error" || j.status === "failed" || j.status === "cancelled") {
    console.log("");
    console.log(`Job ended with status: ${j.status}`);
    if (j.error) console.log(`  error: ${JSON.stringify(j.error)}`);
    process.exit(1);
  }
}

// ---- Helpers -------------------------------------------------------------

async function fileToBlob(filePath) {
  const chunks = [];
  for await (const chunk of createReadStream(filePath)) {
    chunks.push(chunk);
  }
  return new Blob(chunks);
}
