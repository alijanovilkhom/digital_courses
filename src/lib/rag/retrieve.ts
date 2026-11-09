import { embed } from "./gemini";
import { loadIndex } from "./store";

export type Hit = { source: string; text: string; score: number };

export function hasMaterials(): boolean {
  const index = loadIndex();
  return !!index && Object.values(index.files).some((f) => f.chunks.length > 0);
}

// Vectors are unit length, so the dot product is the cosine similarity
export async function retrieve(query: string, k = 6): Promise<Hit[]> {
  const index = loadIndex();
  if (!index) return [];
  const [q] = await embed([query], "RETRIEVAL_QUERY");

  const hits: Hit[] = [];
  for (const [source, file] of Object.entries(index.files)) {
    for (const chunk of file.chunks) {
      let score = 0;
      for (let i = 0; i < q.length; i++) score += q[i] * chunk.embedding[i];
      hits.push({ source, text: chunk.text, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}
