import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chunkText } from "./chunk";
import { extractText } from "./extract";
import { DIMENSIONS, EMBEDDING_MODEL, MissingKeyError, embed } from "./gemini";
import { EXTENSIONS, KNOWLEDGE_DIR } from "./paths";
import { emptyIndex, loadIndex, saveIndex } from "./store";

export type SyncResult = {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  skipped: string[];
  chunks: number;
};

// Every readable file under knowledge/, as a path relative to it. Skips hidden and Office lock files (~$...)
function listFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".") || e.name.startsWith("~$")) return [];
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listFiles(full, base);
    return EXTENSIONS.has(path.extname(e.name).toLowerCase())
      ? [path.relative(base, full).split(path.sep).join("/")]
      : [];
  });
}

async function doSync(): Promise<SyncResult> {
  let index = loadIndex();
  // A different model or vector size makes the stored vectors unusable: start over
  if (!index || index.model !== EMBEDDING_MODEL || index.dimensions !== DIMENSIONS) {
    index = emptyIndex(EMBEDDING_MODEL, DIMENSIONS);
  }

  const result: SyncResult = { added: 0, updated: 0, removed: 0, unchanged: 0, skipped: [], chunks: 0 };
  const seen = new Set<string>();

  for (const rel of listFiles(KNOWLEDGE_DIR)) {
    seen.add(rel);
    const buf = fs.readFileSync(path.join(KNOWLEDGE_DIR, rel));
    const hash = crypto.createHash("sha1").update(buf).digest("hex");
    const existing = index.files[rel];
    if (existing?.hash === hash) {
      result.unchanged++;
      continue;
    }

    let chunks: string[];
    try {
      chunks = chunkText(await extractText(rel, buf));
    } catch (err) {
      console.warn(`[rag] cannot read ${rel}:`, err instanceof Error ? err.message : err);
      result.skipped.push(rel);
      continue;
    }
    if (chunks.length === 0) {
      result.skipped.push(rel);
      continue;
    }

    // The file name goes in front of each chunk: names like mentors/madina-rahimova.txt help matching
    const vectors = await embed(chunks.map((c) => `${rel}\n${c}`), "RETRIEVAL_DOCUMENT");
    index.files[rel] = { hash, chunks: chunks.map((text, i) => ({ text, embedding: vectors[i] })) };
    if (existing) result.updated++;
    else result.added++;
    saveIndex(index); // keep progress if a later file fails
  }

  for (const rel of Object.keys(index.files)) {
    if (!seen.has(rel)) {
      delete index.files[rel];
      result.removed++;
    }
  }
  if (result.removed) saveIndex(index);

  result.chunks = Object.values(index.files).reduce((n, f) => n + f.chunks.length, 0);
  return result;
}

// One sync at a time, and at most one folder scan every few seconds however many questions arrive
const THROTTLE_MS = 10_000;
let running: Promise<SyncResult> | null = null;
let last: { at: number; result: SyncResult } | null = null;

export function syncIndex(force = false): Promise<SyncResult> {
  if (running) return running;
  if (!force && last && Date.now() - last.at < THROTTLE_MS) return Promise.resolve(last.result);
  running = doSync()
    .then((result) => {
      last = { at: Date.now(), result };
      return result;
    })
    .finally(() => {
      running = null;
    });
  return running;
}

export { MissingKeyError };
