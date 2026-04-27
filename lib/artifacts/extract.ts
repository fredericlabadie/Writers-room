import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const TEXT_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const DOCX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const PDF_MIME = new Set(["application/pdf"]);

const IMAGE_MIME_PREFIX = "image/";

export function isSupportedArtifactMime(mimeType: string) {
  return TEXT_MIME.has(mimeType) || DOCX_MIME.has(mimeType) || PDF_MIME.has(mimeType) || mimeType.startsWith(IMAGE_MIME_PREFIX);
}

export function getArtifactKind(mimeType: string): "document" | "image" {
  if (mimeType.startsWith(IMAGE_MIME_PREFIX)) return "image";
  return "document";
}

export async function extractArtifactText(args: {
  mimeType: string;
  name: string;
  buffer: Buffer;
}) {
  const mimeType = args.mimeType || "application/octet-stream";

  if (mimeType.startsWith(IMAGE_MIME_PREFIX)) {
    return {
      text: "",
      note: "Image uploaded. OCR is not enabled in v1.",
    };
  }

  if (TEXT_MIME.has(mimeType)) {
    return { text: args.buffer.toString("utf8") };
  }

  if (DOCX_MIME.has(mimeType)) {
    const out = await mammoth.extractRawText({ buffer: args.buffer });
    return { text: out.value };
  }

  if (PDF_MIME.has(mimeType)) {
    const parser = new PDFParse({ data: new Uint8Array(args.buffer) });
    const out = await parser.getText();
    await parser.destroy();
    return { text: out.text };
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
