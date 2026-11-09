import fs from "node:fs";
import path from "node:path";

// data/index.json is a cache of vectors for the files in knowledge/. It is not a database:
// delete it at any time and the next sync rebuilds it.

export type Chunk = { text: string; embedding: number[] };
export type FileEntry = { hash: string; chunks: Chunk[] };
export type Index = { model: string; dimensions: number; files: Record<string, FileEntry> };

const FILE = path.join(process.cwd(), "data", "index.json");

let cache: { mtime: number; index: Index } | null = null;

export function emptyIndex(model: string, dimensions: number): Index {
  return { model, dimensions, files: {} };
}

export function loadIndex(): Index | null {
  try {
    const { mtimeMs } = fs.statSync(FILE);
    if (cache?.mtime !== mtimeMs) {
      cache = { mtime: mtimeMs, index: JSON.parse(fs.readFileSync(FILE, "utf8")) as Index };
    }
    return cache.index;
  } catch {
    return null;
  }
}

export function saveIndex(index: Index): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  // Write to a temp file first so a concurrent reader never sees half a file
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(index));
  fs.renameSync(tmp, FILE);
  cache = { mtime: fs.statSync(FILE).mtimeMs, index };
}
