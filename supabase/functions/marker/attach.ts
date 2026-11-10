// Attachments sent from the dashboard (shared by the marker and the tutor; keep the copies in marker/ and ai/ identical).
// The browser does the heavy lifting: photos are resized to JPEG, each video becomes a few still frames, Word and
// text files become plain text. Here we check the limits and turn them into Claude content blocks.
//
// attachments: [{ type: "image", media_type, data, label? }, { type: "pdf", data, name }, { type: "text", name, text }]
export const MAX_PHOTOS = 10, MAX_VIDEOS = 2, FRAMES_PER_VIDEO = 8, MAX_DOCS = 5;
const MAX_IMAGES = MAX_PHOTOS + MAX_VIDEOS * FRAMES_PER_VIDEO;
const MAX_IMAGE_B64 = 6_000_000;
const MAX_PDF_B64 = 22_000_000, MAX_PDF_TOTAL_B64 = 26_000_000;
const MAX_TEXT = 60_000, MAX_TEXT_TOTAL = 100_000;
export const MAX_BODY = 32_000_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const B64 = /^[A-Za-z0-9+/=\s]+$/;

export type Parsed = { blocks: any[]; images: number; photos: number; videos: number; pdfs: number; texts: number; textChars: number; summary: string };

const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const plural = (n: number, w: string) => n + " " + w + (n === 1 ? "" : "s");

export function parseAttachments(raw: unknown): Parsed | { error: string } {
  const out: Parsed = { blocks: [], images: 0, photos: 0, videos: 0, pdfs: 0, texts: 0, textChars: 0, summary: "" };
  if (raw == null) return out;
  if (!Array.isArray(raw)) return { error: "Those attachments couldn’t be read. Try adding them again." };
  let pdfTotal = 0;
  const videoIds = new Set<string>(), names: string[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") return { error: "One of your attachments couldn’t be read. Remove it and add it again." };
    if (a.type === "image") {
      if (!IMAGE_TYPES.has(a.media_type) || typeof a.data !== "string" || a.data.length > MAX_IMAGE_B64 || !B64.test(a.data.slice(0, 200)))
        return { error: "One of the photos couldn’t be used. Try a JPEG or PNG." };
      if (++out.images > MAX_IMAGES) return { error: "That’s too many photos to send at once." };
      if (a.video != null) videoIds.add(String(a.video)); else out.photos++;
      const label = clean(a.label, 120);
      if (label) out.blocks.push({ type: "text", text: label + ":" });
      out.blocks.push({ type: "image", source: { type: "base64", media_type: a.media_type, data: a.data } });
    } else if (a.type === "pdf") {
      if (typeof a.data !== "string" || a.data.length > MAX_PDF_B64 || !B64.test(a.data.slice(0, 200))) return { error: "That PDF is too large. Try one under 15 MB." };
      pdfTotal += a.data.length;
      if (pdfTotal > MAX_PDF_TOTAL_B64) return { error: "Those PDFs are too large together. Try fewer or smaller files." };
      if (++out.pdfs + out.texts > MAX_DOCS) return { error: "That’s too many files to send at once." };
      const name = clean(a.name, 120) || "Document";
      names.push(name);
      out.blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data }, title: name });
    } else if (a.type === "text") {
      const text = String(a.text ?? "").slice(0, MAX_TEXT);
      if (!text.trim()) continue;
      out.textChars += text.length;
      if (out.textChars > MAX_TEXT_TOTAL) return { error: "Those files have too much text to send at once. Try fewer or shorter files." };
      if (++out.texts + out.pdfs > MAX_DOCS) return { error: "That’s too many files to send at once." };
      const name = clean(a.name, 120) || "Document";
      names.push(name);
      out.blocks.push({ type: "document", source: { type: "text", media_type: "text/plain", data: text }, title: name });
    } else return { error: "One of your attachments couldn’t be read. Remove it and add it again." };
  }
  out.videos = videoIds.size;
  if (out.photos > MAX_PHOTOS) return { error: "You can add up to " + MAX_PHOTOS + " photos." };
  if (out.videos > MAX_VIDEOS) return { error: "You can add up to " + MAX_VIDEOS + " videos." };
  const parts: string[] = [];
  if (out.photos) parts.push(plural(out.photos, "photo"));
  if (out.videos) parts.push(plural(out.videos, "video") + " (as still frames, no sound)");
  parts.push(...names);
  out.summary = parts.join(", ");
  return out;
}

// Anthropic's 400s for attachments, in words a student understands.
export function attachmentError(text: string): string | null {
  if (/pdf|page/i.test(text) && /(exceed|too many|maximum|limit|100)/i.test(text)) return "That PDF has too many pages. Try one under 100 pages, or just the pages you need.";
  if (/pdf|document/i.test(text)) return "That PDF couldn’t be opened. Try saving it again or adding photos of the pages instead.";
  if (/image/i.test(text)) return "One of the photos couldn’t be read. Try a different photo.";
  return null;
}
