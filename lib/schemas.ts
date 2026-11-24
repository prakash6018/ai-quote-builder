import { z } from "zod";
import { CURRENCIES, FINISHES, MATERIALS, PROCESSES, TIERS, TOLERANCES } from "./catalog.ts";

const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const lineSchema = z.object({
  id: z.string().min(1).max(40),
  partName: z.string().trim().min(1, "Part name is required").max(120),
  drawing: z.string().regex(/^[a-f0-9]{64}$/).nullable().default(null),
  process: z.enum(keys(PROCESSES)),
  material: z.enum(keys(MATERIALS)),
  lengthMm: z.number().positive("Must be more than 0").max(3000, "Max 3000 mm"),
  widthMm: z.number().positive("Must be more than 0").max(3000, "Max 3000 mm"),
  heightMm: z.number().positive("Must be more than 0").max(1000, "Max 1000 mm"),
  quantity: z.number().int("Whole number").min(1).max(100_000),
  finish: z.enum(keys(FINISHES)),
  tolerance: z.enum(keys(TOLERANCES)),
  holes: z.number().int().min(0).max(500),
  bends: z.number().int().min(0).max(100),
  /** Per-field confidence from drawing extraction (0..1). Absent for manual lines. */
  confidence: z.record(z.number().min(0).max(1)).default({}),
  reviewed: z.boolean().default(true),
});

export type Line = z.infer<typeof lineSchema>;

export const saveQuoteSchema = z
  .object({
    tier: z.enum(keys(TIERS)),
    depositPct: z.number().int().min(0).max(100),
    note: z.string().max(500).optional(),
    lines: z.array(lineSchema).min(1, "Add at least one part").max(200),
  })
  .strict();

export const newQuoteSchema = z.object({
  customerName: z.string().trim().min(1, "Customer is required").max(120),
  customerEmail: z.string().trim().email("Enter a valid email"),
  currency: z.enum(keys(CURRENCIES)),
});

/** Fields a reviewer should look at when extraction confidence is below this. */
export const REVIEW_THRESHOLD = 0.75;

export const fieldsNeedingReview = (line: Line) =>
  line.reviewed ? [] : Object.entries(line.confidence).filter(([, c]) => c < REVIEW_THRESHOLD).map(([k]) => k);
