import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

// One line per spreadsheet row ("column: value; ..."), so rows stay readable after chunking
function sheetsToText(buf: Buffer, ext: string): string {
  const wb = XLSX.read(buf, { type: "buffer", codepage: ext === ".csv" ? 65001 : undefined });
  const lines: string[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: "" });
    rows.forEach((row, i) => {
      const cells = Object.entries(row)
        .map(([k, v]) => [k, String(v).trim()] as const)
        .filter(([, v]) => v !== "")
        .map(([k, v]) => `${k}: ${v}`);
      if (cells.length) lines.push(`Лист «${name}», строка ${i + 2}. ${cells.join("; ")}`);
    });
  }
  return lines.join("\n");
}

export async function extractText(file: string, buf: Buffer): Promise<string> {
  const ext = path.extname(file).toLowerCase();
  switch (ext) {
    case ".md":
    case ".txt":
      return buf.toString("utf8");
    case ".pdf": {
      const parser = new PDFParse({ data: buf });
      try {
        return (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    }
    case ".docx":
      return (await mammoth.extractRawText({ buffer: buf })).value;
    case ".xlsx":
    case ".xls":
    case ".csv":
      return sheetsToText(buf, ext);
    default:
      throw new Error(`unsupported file type: ${ext}`);
  }
}
