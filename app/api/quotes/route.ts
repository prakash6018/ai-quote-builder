import { createHash, randomUUID } from "node:crypto";
import { config, extractor } from "@/lib/config.ts";
import { extractionToLine, sniffImage } from "@/lib/extract.ts";
import { fail, json } from "@/lib/http.ts";
import { priceQuote } from "@/lib/pricing.ts";
import { lineSchema, newQuoteSchema, type Line } from "@/lib/schemas.ts";
import { createQuote, listQuotes, saveUpload } from "@/lib/store.ts";
import { quoteSummary } from "@/lib/views.ts";

const MAX_FILES = 10;
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET() {
  return json({ quotes: (await listQuotes()).map(quoteSummary) });
}

/** multipart/form-data: customerName, customerEmail, currency, drawings[] */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return fail(400, "Send the form as multipart/form-data.");
  const meta = newQuoteSchema.safeParse({
    customerName: form.get("customerName"),
    customerEmail: form.get("customerEmail"),
    currency: form.get("currency"),
  });
  if (!meta.success) return fail(400, meta.error.issues[0].message, { field: meta.error.issues[0].path[0] });

  const files = form.getAll("drawings").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (files.length > MAX_FILES) return fail(400, `Upload at most ${MAX_FILES} drawings at a time.`);

  const ex = extractor();
  const lines: Line[] = [];
  const problems: string[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) { problems.push(`${file.name}: larger than 8 MB`); continue; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) { problems.push(`${file.name}: not a PNG, JPEG or WebP image`); continue; }
    const sha = createHash("sha256").update(bytes).digest("hex");
    await saveUpload(sha, bytes);
    try {
      const extraction = await ex.extract({ bytes, mime, sha256: sha, filename: file.name });
      lines.push(lineSchema.parse(extractionToLine(extraction, randomUUID(), sha)));
    } catch {
      problems.push(`${file.name}: couldn't read the drawing; add this part by hand`);
    }
  }
  if (problems.length && !lines.length && files.length) return fail(422, problems.join(". "), { problems });
  if (!lines.length)
    lines.push(lineSchema.parse({ id: randomUUID(), partName: "New part", process: "cnc", material: "al-6061", lengthMm: 100, widthMm: 50, heightMm: 10, quantity: 1, finish: "none", tolerance: "standard", holes: 0, bends: 0 }));

  const currency = meta.data.currency;
  const fxRate = currency === "USD" ? 1 : config.fxUsdInr();
  const price = priceQuote(lines, "standard", 30, currency, fxRate);
  const q = await createQuote({
    customer: { name: meta.data.customerName, email: meta.data.customerEmail },
    currency,
    fxRate,
    first: { tier: "standard", depositPct: 30, lines, subtotalCents: price.subtotalCents, depositCents: price.depositCents, note: `Created from ${files.length} drawing${files.length === 1 ? "" : "s"} (${ex.name} extractor)` },
  });
  return json({ id: q.id, problems }, 201);
}
