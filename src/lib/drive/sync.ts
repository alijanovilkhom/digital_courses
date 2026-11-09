import fs from "node:fs";
import path from "node:path";
import { EXTENSIONS, KNOWLEDGE_DIR } from "../rag/paths";
import { accessToken, driveConfigured } from "./auth";

// Mirrors one Google Drive folder into knowledge/. Only files changed on Drive (by modifiedTime) are downloaded,
// files removed from Drive are removed locally. The site reads knowledge/ as before; nothing else changes.

const API = "https://www.googleapis.com/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";

// Google's own formats cannot be downloaded as they are: export them to a format the reader understands
const EXPORTS: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: ".docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: ".xlsx",
  },
  "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: ".pdf" },
};

const STATE_FILE = path.join(process.cwd(), "data", "drive-state.json");
// Files that were in knowledge/ before the first Drive sync are moved here, never deleted
const SAMPLE_DIR = path.join(process.cwd(), "knowledge-sample");

type RemoteFile = { id: string; name: string; mimeType: string; modifiedTime: string; rel: string };
type State = { files: Record<string, { id: string; modifiedTime: string }> };

export type DriveSyncResult = {
  downloaded: string[];
  removed: string[];
  unchanged: number;
  skipped: string[];
  adopted: string[];
};

async function driveFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { authorization: `Bearer ${await accessToken()}` } });
    const transient = res.status === 429 || res.status >= 500;
    if (res.ok || !transient || attempt >= 2) {
      if (!res.ok) throw new Error(await describeError(res, url));
      return res;
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
}

// Google's own explanation ("File not found: <id>") is far more useful than the bare status code
async function describeError(res: Response, url: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  const reason = body?.error?.message ? `: ${body.error.message}` : "";
  const hint =
    res.status === 404
      ? " Check GOOGLE_DRIVE_FOLDER_ID (the folder ID only) and that the folder is visible to the Google account used in `npm run drive-auth`."
      : res.status === 403
        ? " Check that the Google Drive API is enabled in the Google Cloud project and that the account can open the folder."
        : "";
  return `Google Drive answered ${res.status} for ${url.split("?")[0]}${reason}.${hint}`;
}

// The setting may hold the folder ID or the whole link copied from the browser's address bar
function folderIdFromEnv(): string {
  const raw = (process.env.GOOGLE_DRIVE_FOLDER_ID ?? "").trim();
  return /\/folders\/([\w-]+)/.exec(raw)?.[1] ?? raw;
}

// A Drive name becomes a local file name: no path separators, nothing hidden, nothing that is an Office lock file
function safeName(name: string): string {
  return name.replace(/[\\/\u0000-\u001f]/g, "_").replace(/^\.+/, "_").trim() || "_";
}

async function listTree(folderId: string, prefix = ""): Promise<RemoteFile[]> {
  const out: RemoteFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,modifiedTime)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const body = (await (await driveFetch(`${API}/files?${params}`)).json()) as {
      files?: Omit<RemoteFile, "rel">[];
      nextPageToken?: string;
    };
    for (const f of body.files ?? []) {
      const name = safeName(f.name);
      if (f.mimeType === FOLDER) out.push(...(await listTree(f.id, `${prefix}${name}/`)));
      else out.push({ ...f, rel: `${prefix}${name}` });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return out;
}

// Local path for a remote file, or null when the reader cannot use it
function localPath(f: RemoteFile): string | null {
  if (path.basename(f.rel).startsWith("~$")) return null;
  const exp = EXPORTS[f.mimeType];
  if (exp) return f.rel.replace(/\.[^./]+$/, (m) => (m.toLowerCase() === exp.ext ? "" : m)) + exp.ext;
  if (f.mimeType.startsWith("application/vnd.google-apps.")) return null; // forms, maps, shortcuts...
  return EXTENSIONS.has(path.extname(f.rel).toLowerCase()) ? f.rel : null;
}

function loadState(): State | null {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as State;
  } catch {
    return null;
  }
}

function saveState(state: State): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function inside(dir: string, file: string): boolean {
  const rel = path.relative(dir, file);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

function pruneEmptyDirs(dir: string): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const full = path.join(dir, e.name);
    pruneEmptyDirs(full);
    if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
  }
}

async function doDriveSync(): Promise<DriveSyncResult> {
  const folderId = folderIdFromEnv();
  const result: DriveSyncResult = { downloaded: [], removed: [], unchanged: 0, skipped: [], adopted: [] };

  // What should exist locally. Two Drive files that map to one name keep the first; the other is skipped.
  const wanted = new Map<string, RemoteFile>();
  for (const f of await listTree(folderId)) {
    const rel = localPath(f);
    if (!rel) result.skipped.push(f.rel);
    else if (wanted.has(rel)) result.skipped.push(`${f.rel} (same name as another file)`);
    else wanted.set(rel, f);
  }

  // "report 2.docx" next to "report.docx" is usually a copy made by iCloud or an upload done twice: say so, do not guess
  const copies = [...wanted.keys()].filter((rel) => {
    const m = /^(.*) \d+(\.[^./]*)?$/.exec(rel);
    return m && wanted.has(m[1] + (m[2] ?? ""));
  });
  if (copies.length) {
    console.warn(`[drive] ${copies.length} file(s) look like duplicate copies (named "... 2"): ${copies.slice(0, 3).join(", ")}${copies.length > 3 ? ", ..." : ""}. Delete them in Drive if they are not needed.`);
  }

  const previous = loadState();
  const state: State = { files: { ...(previous?.files ?? {}) } };

  // An empty answer next to a non-empty history is far more likely a wrong folder or lost access than a wish
  // to delete everything, so refuse to touch the local files and say so.
  if (wanted.size === 0 && Object.keys(state.files).length > 0) {
    throw new Error("The Drive folder looks empty, so nothing was removed locally. Check GOOGLE_DRIVE_FOLDER_ID and sharing.");
  }

  // First Drive sync: Drive replaces what is in knowledge/. The old files are kept in knowledge-sample/.
  if (!previous && wanted.size > 0) {
    for (const file of walk(KNOWLEDGE_DIR)) {
      const rel = path.relative(KNOWLEDGE_DIR, file);
      const target = path.join(SAMPLE_DIR, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(file, target);
      result.adopted.push(rel.split(path.sep).join("/"));
    }
  }

  try {
    for (const [rel, f] of wanted) {
      const dest = path.join(KNOWLEDGE_DIR, rel);
      if (!inside(KNOWLEDGE_DIR, dest)) {
        result.skipped.push(rel);
        continue;
      }
      const known = state.files[rel];
      if (known?.id === f.id && known.modifiedTime === f.modifiedTime && fs.existsSync(dest)) {
        result.unchanged++;
        continue;
      }
      const exp = EXPORTS[f.mimeType];
      const url = exp
        ? `${API}/files/${f.id}/export?mimeType=${encodeURIComponent(exp.mime)}`
        : `${API}/files/${f.id}?alt=media&supportsAllDrives=true`;
      let bytes: Buffer;
      try {
        bytes = Buffer.from(await (await driveFetch(url)).arrayBuffer());
      } catch (err) {
        // One file that cannot be fetched (for example a Google Doc over the 10 MB export limit) must not stop the rest
        console.warn(`[drive] cannot download ${f.rel}:`, err instanceof Error ? err.message : err);
        result.skipped.push(rel);
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const tmp = `${dest}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, bytes);
      fs.renameSync(tmp, dest);
      state.files[rel] = { id: f.id, modifiedTime: f.modifiedTime };
      result.downloaded.push(rel);
    }

    // Removed from Drive: remove here too (only files this sync put there)
    for (const rel of Object.keys(state.files)) {
      if (wanted.has(rel)) continue;
      const dest = path.join(KNOWLEDGE_DIR, rel);
      if (inside(KNOWLEDGE_DIR, dest) && fs.existsSync(dest)) fs.rmSync(dest);
      delete state.files[rel];
      result.removed.push(rel);
    }
    if (fs.existsSync(KNOWLEDGE_DIR)) pruneEmptyDirs(KNOWLEDGE_DIR);
  } finally {
    saveState(state);
  }
  return result;
}

// One sync at a time
let running: Promise<DriveSyncResult> | null = null;

export function syncDrive(): Promise<DriveSyncResult> {
  return (running ??= doDriveSync().finally(() => {
    running = null;
  }));
}

// Called from page and chat requests: look at Drive at most every 5 minutes, without making the visitor wait.
// Changes show up on the next request. Does nothing where the disk is read-only (Vercel): there the sync runs at build time.
const CHECK_EVERY_MS = 5 * 60_000;
let lastCheck = 0;

function writable(): boolean {
  try {
    fs.accessSync(fs.existsSync(KNOWLEDGE_DIR) ? KNOWLEDGE_DIR : process.cwd(), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function checkDriveInBackground(): void {
  if (!driveConfigured() || process.env.VERCEL || running || Date.now() - lastCheck < CHECK_EVERY_MS || !writable()) return;
  lastCheck = Date.now();
  syncDrive()
    .then((r) => {
      if (r.downloaded.length || r.removed.length) {
        console.log(`[drive] ${r.downloaded.length} downloaded, ${r.removed.length} removed`);
      }
    })
    .catch((err) => console.error("[drive] background sync failed:", err instanceof Error ? err.message : err));
}
