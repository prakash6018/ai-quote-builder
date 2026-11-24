import { z } from "zod";
import { fail, isUuid, json } from "@/lib/http.ts";
import { priceQuote } from "@/lib/pricing.ts";
import { saveQuoteSchema } from "@/lib/schemas.ts";
import { addVersion, ConflictError, getQuote } from "@/lib/store.ts";
import { quoteView } from "@/lib/views.ts";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const q = isUuid(id) ? await getQuote(id) : undefined;
  return q ? json(quoteView(q)) : fail(404, "Quote not found.");
}

const bodySchema = saveQuoteSchema.extend({ expectedVersion: z.number().int().min(1) });

/** Saves the edited quote as a new version. Totals are recomputed here, never taken from the client. */
export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(404, "Quote not found.");
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return fail(400, `${i.path.join(".")}: ${i.message}`);
  }
  const q = await getQuote(id);
  if (!q) return fail(404, "Quote not found.");
  const { expectedVersion, ...v } = parsed.data;
  const price = priceQuote(v.lines, v.tier, v.depositPct, q.currency, q.fxRate);
  try {
    const saved = await addVersion(id, { ...v, subtotalCents: price.subtotalCents, depositCents: price.depositCents }, expectedVersion);
    return saved ? json(quoteView(saved)) : fail(404, "Quote not found.");
  } catch (e) {
    if (e instanceof ConflictError) return fail(409, e.message);
    throw e;
  }
}
