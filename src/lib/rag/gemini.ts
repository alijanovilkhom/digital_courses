import { GoogleGenAI } from "@google/genai";

// Models can be changed in .env.local without touching code. The embedding model must behave like
// gemini-embedding-001 (one vector per input string, supports taskType).
export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-3.5-flash-lite";
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
export const DIMENSIONS = 768;

const BATCH = 50;
const REQUEST_TIMEOUT_MS = 45_000;

export class MissingKeyError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key.");
  }
}

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new MissingKeyError();
  // A model that never answers must not keep a visitor waiting forever
  return (client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } }));
}

// Gemini answers 503 "high demand" during traffic spikes. Those pass quickly, so try again a couple of times.
export async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      if ((err as { status?: number }).status !== 503 || attempt >= 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
}

// Truncated vectors are not unit length, so normalise: cosine similarity is then a plain dot product
function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function embed(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await withRetry(() =>
      gemini().models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch,
        config: { taskType, outputDimensionality: DIMENSIONS },
      }),
    );
    const vectors = res.embeddings ?? [];
    if (vectors.length !== batch.length) {
      throw new Error(`embedding model returned ${vectors.length} vectors for ${batch.length} texts`);
    }
    out.push(...vectors.map((e) => normalize(e.values ?? [])));
  }
  return out;
}
