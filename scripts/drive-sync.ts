import { driveConfigured } from "../src/lib/drive/auth";
import { syncDrive } from "../src/lib/drive/sync";

async function main() {
  // Without Drive settings this is not an error: the site keeps working from knowledge/ as it is
  if (!driveConfigured()) {
    console.log("Google Drive is not configured (see .env.example), skipping.");
    return;
  }
  const r = await syncDrive();
  console.log(
    `Drive is in sync: ${r.downloaded.length} downloaded, ${r.removed.length} removed, ${r.unchanged} unchanged.`,
  );
  if (r.adopted.length) {
    console.log(`First sync: ${r.adopted.length} existing file(s) of knowledge/ moved to knowledge-sample/.`);
  }
  if (r.skipped.length) console.warn(`Skipped (unsupported type or unreadable): ${r.skipped.join(", ")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
