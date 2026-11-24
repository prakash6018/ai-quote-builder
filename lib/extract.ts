// Drawing → structured part data. Uses a vision model (any OpenAI-compatible
// endpoint) with a strict JSON schema, then validates the reply with Zod. Each
// field comes back with a confidence so the reviewer knows what to check.
import { z } from "zod";
import { FINISHES, MATERIALS, PROCESSES, TOLERANCES } from "./catalog.ts";

const field = <T extends z.ZodTypeAny>(v: T) => z.object({ value: v, confidence: z.number().min(0).max(1) });
const enumOf = (o: Record<string, unknown>) => z.enum(Object.keys(o) as [string, ...string[]]);

export const extractionSchema = z.object({
  partName: field(z.string().min(1).max(120)),
  process: field(enumOf(PROCESSES)),
  material: field(enumOf(MATERIALS)),
  lengthMm: field(z.number().positive()),
  widthMm: field(z.number().positive()),
  heightMm: field(z.number().positive()),
  quantity: field(z.number().int().positive()),
  finish: field(enumOf(FINISHES)),
  tolerance: field(enumOf(TOLERANCES)),
  holes: field(z.number().int().min(0)),
  bends: field(z.number().int().min(0)),
});

export type Extraction = z.infer<typeof extractionSchema>;

export interface Extractor {
  name: string;
  extract(image: { bytes: Uint8Array; mime: string; sha256: string; filename: string }): Promise<Extraction>;
}

const PROMPT = `You read mechanical engineering drawings for a job shop's estimating team.
Return the part's name (from the title block), manufacturing process, material, overall bounding
dimensions in millimetres (length >= width; for sheet metal, height is the sheet thickness), the
quantity if stated (else 1), surface finish, tolerance class, number of holes and number of bends.
Use only these codes:
process: ${Object.keys(PROCESSES).join(", ")}
material: ${Object.keys(MATERIALS).join(", ")}
finish: ${Object.keys(FINISHES).join(", ")}
tolerance: ${Object.keys(TOLERANCES).join(", ")} (standard ±0.1, precision ±0.05, tight ±0.01 mm)
For every field give confidence from 0 to 1. Use a low confidence when you are inferring rather than reading a value.`;

/** JSON Schema for structured outputs (strict mode needs every property required). */
function jsonSchema() {
  const f = (schema: object) => ({ type: "object", additionalProperties: false, required: ["value", "confidence"], properties: { value: schema, confidence: { type: "number" } } });
  const props = {
    partName: f({ type: "string" }),
    process: f({ type: "string", enum: Object.keys(PROCESSES) }),
    material: f({ type: "string", enum: Object.keys(MATERIALS) }),
    lengthMm: f({ type: "number" }),
    widthMm: f({ type: "number" }),
    heightMm: f({ type: "number" }),
    quantity: f({ type: "integer" }),
    finish: f({ type: "string", enum: Object.keys(FINISHES) }),
    tolerance: f({ type: "string", enum: Object.keys(TOLERANCES) }),
    holes: f({ type: "integer" }),
    bends: f({ type: "integer" }),
  };
  return { type: "object", additionalProperties: false, required: Object.keys(props), properties: props };
}

export class VisionExtractor implements Extractor {
  name = "vision";
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.model = model;
  }

  async extract(image: { bytes: Uint8Array; mime: string }): Promise<Extraction> {
    const dataUrl = `data:${image.mime};base64,${Buffer.from(image.bytes).toString("base64")}`;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: [{ type: "text", text: "Extract the part data from this drawing." }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] },
        ],
        response_format: { type: "json_schema", json_schema: { name: "part", strict: true, schema: jsonSchema() } },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`vision model returned ${res.status}`);
    const body: any = await res.json();
    return extractionSchema.parse(JSON.parse(body.choices?.[0]?.message?.content ?? "{}"));
  }
}

/**
 * Offline extractor for the demo: knows the bundled sample drawings by hash
 * and returns a low-confidence guess for anything else, so the review step
 * has something to do.
 */
export class SampleExtractor implements Extractor {
  name = "sample";
  private known: Record<string, Extraction>;

  constructor(known: Record<string, Extraction>) {
    this.known = known;
  }

  async extract(image: { sha256: string; filename: string }): Promise<Extraction> {
    const hit = this.known[image.sha256];
    if (hit) return hit;
    const name = image.filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Unnamed part";
    const low = <T>(value: T, confidence = 0.3) => ({ value, confidence });
    return {
      partName: low(name, 0.6),
      process: low("cnc"),
      material: low("al-6061"),
      lengthMm: low(100),
      widthMm: low(50),
      heightMm: low(10),
      quantity: low(1, 0.5),
      finish: low("none"),
      tolerance: low("standard", 0.5),
      holes: low(0),
      bends: low(0),
    };
  }
}

/** Turns an extraction into a quote line, keeping per-field confidence. */
export function extractionToLine(e: Extraction, id: string, drawing: string) {
  const confidence = Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v.confidence]));
  return {
    id,
    drawing,
    partName: e.partName.value,
    process: e.process.value,
    material: e.material.value,
    lengthMm: e.lengthMm.value,
    widthMm: e.widthMm.value,
    heightMm: e.heightMm.value,
    quantity: e.quantity.value,
    finish: e.finish.value,
    tolerance: e.tolerance.value,
    holes: e.holes.value,
    bends: e.bends.value,
    confidence,
    reviewed: Object.values(confidence).every((c) => c >= 0.75),
  };
}

/** Accept only real image files, checked by magic bytes rather than the file name. */
export function sniffImage(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
