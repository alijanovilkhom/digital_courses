import { MissingKeyError, syncIndex } from "../src/lib/rag/sync";

async function main() {
  const r = await syncIndex(true);
  console.log(
    `Index is up to date: ${r.added} added, ${r.updated} updated, ${r.removed} removed, ${r.unchanged} unchanged, ${r.chunks} chunks in total.`,
  );
  if (r.skipped.length) console.warn(`Skipped (unreadable or empty): ${r.skipped.join(", ")}`);
}

main().catch((err) => {
  console.error(err instanceof MissingKeyError ? err.message : err);
  process.exit(1);
});
