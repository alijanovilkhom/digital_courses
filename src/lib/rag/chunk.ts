// About 1600 characters is roughly 800 tokens of Russian text.
const SIZE = 1600;
const OVERLAP = 200;

// Break an over-long line so one line never exceeds a chunk
function pieces(line: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += SIZE) out.push(line.slice(i, i + SIZE));
  return out;
}

export function chunkText(text: string): string[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let cur: string[] = [];
  let len = 0;

  for (const line of lines) {
    for (const piece of pieces(line)) {
      if (cur.length && len + piece.length + 1 > SIZE) {
        chunks.push(cur.join("\n"));
        // Start the next chunk with the last lines of this one, so context is not cut mid-thought
        const keep: string[] = [];
        let kept = 0;
        for (let i = cur.length - 1; i >= 0 && kept + cur[i].length + 1 <= OVERLAP; i--) {
          keep.unshift(cur[i]);
          kept += cur[i].length + 1;
        }
        cur = keep;
        len = kept;
      }
      cur.push(piece);
      len += piece.length + 1;
    }
  }
  if (cur.length) chunks.push(cur.join("\n"));
  return chunks;
}
