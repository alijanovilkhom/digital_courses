import path from "node:path";

// Kept apart from extract.ts and sync.ts so the Drive code and the pages do not pull in the PDF/DOCX readers
export const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
export const EXTENSIONS = new Set([".md", ".txt", ".pdf", ".docx", ".xlsx", ".xls", ".csv"]);
