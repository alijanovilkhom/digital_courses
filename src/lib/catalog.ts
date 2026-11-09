import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { checkDriveInBackground } from "./drive/sync";

// The catalog lives in knowledge/catalog.xlsx (sheets "Courses" and "Teachers").
// Rows added there appear on the site, rows removed disappear, no rebuild needed.

export type Localized = { ru: string; uz: string; en: string };

export type Teacher = {
  id: string;
  name: string;
  role: Localized;
  bio: Localized;
};

export type Course = {
  id: string;
  title: Localized;
  description: Localized;
  price: number;
  currency: string;
  duration: Localized;
  level: Localized;
  teacherId: string;
};

type Catalog = { courses: Course[]; teachers: Teacher[] };
type Row = Record<string, unknown>;

const FILE = path.join(process.cwd(), "knowledge", "catalog.xlsx");
const LANGS = ["ru", "uz", "en"] as const;
const HIDDEN = new Set(["false", "0", "no", "нет"]);

const text = (v: unknown) => String(v ?? "").trim();

// A language left empty in Excel falls back to the first filled one
function localized(row: Row, base: string): Localized {
  const v = Object.fromEntries(
    LANGS.map((l) => [l, text(row[`${base}_${l}`])]),
  ) as Localized;
  const fallback = v.ru || v.en || v.uz;
  return { ru: v.ru || fallback, uz: v.uz || fallback, en: v.en || fallback };
}

function rows(wb: XLSX.WorkBook, sheet: string): Row[] {
  const ws = wb.Sheets[sheet];
  if (!ws) {
    console.warn(`[catalog] sheet "${sheet}" not found in ${FILE}`);
    return [];
  }
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
}

function parse(buf: Buffer): Catalog {
  const wb = XLSX.read(buf, { type: "buffer" });
  const seen = new Set<string>();
  const skip = (sheet: string, n: number, why: string) =>
    console.warn(`[catalog] ${sheet} row ${n + 2} skipped: ${why}`);

  const teachers: Teacher[] = [];
  rows(wb, "Teachers").forEach((r, i) => {
    const id = text(r.id);
    const name = text(r.name);
    if (!id || !name) return skip("Teachers", i, "id or name is empty");
    if (seen.has(`t:${id}`)) return skip("Teachers", i, `duplicate id "${id}"`);
    seen.add(`t:${id}`);
    teachers.push({ id, name, role: localized(r, "role"), bio: localized(r, "bio") });
  });

  const courses: Course[] = [];
  rows(wb, "Courses").forEach((r, i) => {
    if (HIDDEN.has(text(r.active).toLowerCase())) return;
    const id = text(r.id);
    const title = localized(r, "title");
    const price = Number(text(r.price).replace(/[\s ]/g, ""));
    if (!id || !title.ru) return skip("Courses", i, "id or title is empty");
    if (!Number.isFinite(price)) return skip("Courses", i, "price is not a number");
    if (seen.has(`c:${id}`)) return skip("Courses", i, `duplicate id "${id}"`);
    seen.add(`c:${id}`);
    courses.push({
      id,
      title,
      description: localized(r, "description"),
      price,
      currency: text(r.currency).toUpperCase() || "UZS",
      duration: localized(r, "duration"),
      level: localized(r, "level"),
      teacherId: text(r.teacher_id),
    });
  });

  return { courses, teachers };
}

// Re-parse only when the file changed on disk
let cache: { mtime: number; data: Catalog } | null = null;

export async function getCatalog(): Promise<Catalog> {
  checkDriveInBackground();
  try {
    const { mtimeMs } = await fs.promises.stat(FILE);
    if (cache?.mtime !== mtimeMs) {
      cache = { mtime: mtimeMs, data: parse(await fs.promises.readFile(FILE)) };
    }
    return cache.data;
  } catch (err) {
    console.error(`[catalog] cannot read ${FILE}:`, err);
    // File deleted: show empty sections. File unreadable (e.g. half-saved): keep the last good data.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") cache = null;
    return cache?.data ?? { courses: [], teachers: [] };
  }
}

export function formatPrice(locale: string, price: number, currency: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}
