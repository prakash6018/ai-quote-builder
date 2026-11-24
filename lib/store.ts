// Quotes persisted to a JSON file with atomic writes and a per-process lock.
// Small and dependency-free for the demo; the interface maps directly onto a
// Postgres table (quotes) plus quote_versions and payments.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { Currency, TierKey } from "./catalog.ts";
import type { Line } from "./schemas.ts";

export type QuoteStatus = "draft" | "deposit_pending" | "deposit_paid";

export interface QuoteVersion {
  version: number;
  savedAt: string;
  note?: string;
  tier: TierKey;
  depositPct: number;
  lines: Line[];
  subtotalCents: number;
  depositCents: number;
}

export interface Payment {
  provider: "stripe" | "razorpay";
  eventId: string;
  reference: string;
  amountCents: number;
  currency: Currency;
  at: string;
  matchesDeposit: boolean;
}

export interface Quote {
  id: string;
  number: string;
  customer: { name: string; email: string };
  currency: Currency;
  /** USD → quote currency, fixed when the quote is created so requotes stay comparable. */
  fxRate: number;
  status: QuoteStatus;
  createdAt: string;
  versions: QuoteVersion[];
  payments: Payment[];
  checkout?: { provider: "stripe" | "razorpay"; reference: string; amountCents: number; version: number };
}

interface Db {
  seq: number;
  quotes: Quote[];
  processedEvents: string[];
}

const dir = () => process.env.DATA_DIR ?? join(process.cwd(), ".data");
const file = () => join(dir(), "quotes.json");

let lock: Promise<unknown> = Promise.resolve();

async function load(): Promise<Db> {
  try {
    return JSON.parse(await readFile(file(), "utf8"));
  } catch (e: any) {
    if (e.code === "ENOENT") return { seq: 0, quotes: [], processedEvents: [] };
    throw e;
  }
}

async function save(db: Db) {
  await mkdir(dir(), { recursive: true });
  const tmp = `${file()}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, file());
}

/** Serialise read-modify-write cycles so concurrent requests can't lose updates. */
function tx<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = lock.then(async () => {
    const db = await load();
    const out = await fn(db);
    await save(db);
    return out;
  });
  lock = run.catch(() => {});
  return run;
}

export const current = (q: Quote) => q.versions[q.versions.length - 1];

export async function listQuotes(): Promise<Quote[]> {
  return (await load()).quotes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getQuote(id: string): Promise<Quote | undefined> {
  return (await load()).quotes.find((q) => q.id === id);
}

export function createQuote(input: { customer: Quote["customer"]; currency: Currency; fxRate: number; first: Omit<QuoteVersion, "version" | "savedAt"> }): Promise<Quote> {
  return tx((db) => {
    db.seq += 1;
    const now = new Date();
    const q: Quote = {
      id: randomUUID(),
      number: `Q-${now.getFullYear()}-${String(db.seq).padStart(4, "0")}`,
      customer: input.customer,
      currency: input.currency,
      fxRate: input.fxRate,
      status: "draft",
      createdAt: now.toISOString(),
      versions: [{ ...input.first, version: 1, savedAt: now.toISOString() }],
      payments: [],
    };
    db.quotes.push(q);
    return q;
  });
}

export class ConflictError extends Error {}

/** Saving creates a new version; a paid quote is locked. */
export function addVersion(id: string, v: Omit<QuoteVersion, "version" | "savedAt">, expectedVersion?: number): Promise<Quote | undefined> {
  return tx((db) => {
    const q = db.quotes.find((x) => x.id === id);
    if (!q) return undefined;
    if (q.status === "deposit_paid") throw new ConflictError("This quote has a paid deposit and can't be changed.");
    if (expectedVersion !== undefined && current(q).version !== expectedVersion)
      throw new ConflictError(`Someone saved version ${current(q).version} while you were editing. Reload to see it.`);
    q.versions.push({ ...v, version: current(q).version + 1, savedAt: new Date().toISOString() });
    if (q.status === "deposit_pending") {
      q.status = "draft"; // the old payment link is for an old total
      q.checkout = undefined;
    }
    return q;
  });
}

export function setCheckout(id: string, checkout: NonNullable<Quote["checkout"]>): Promise<Quote | undefined> {
  return tx((db) => {
    const q = db.quotes.find((x) => x.id === id);
    if (!q) return undefined;
    q.checkout = checkout;
    q.status = "deposit_pending";
    return q;
  });
}

/**
 * Records a confirmed payment. Idempotent on eventId, because payment
 * providers retry webhooks and may deliver the same event more than once.
 */
export function recordPayment(quoteId: string, p: Omit<Payment, "at" | "matchesDeposit">): Promise<{ quote?: Quote; duplicate: boolean }> {
  return tx((db) => {
    if (db.processedEvents.includes(p.eventId)) return { quote: db.quotes.find((x) => x.id === quoteId), duplicate: true };
    const q = db.quotes.find((x) => x.id === quoteId);
    if (!q) return { duplicate: false };
    const expected = q.checkout?.amountCents ?? current(q).depositCents;
    const matchesDeposit = p.amountCents === expected && p.currency === q.currency;
    q.payments.push({ ...p, at: new Date().toISOString(), matchesDeposit });
    if (matchesDeposit) q.status = "deposit_paid";
    db.processedEvents.push(p.eventId);
    return { quote: q, duplicate: false };
  });
}

export async function saveUpload(sha: string, bytes: Uint8Array): Promise<void> {
  await mkdir(join(dir(), "uploads"), { recursive: true });
  await writeFile(join(dir(), "uploads", sha), bytes);
}

export async function readUpload(sha: string): Promise<Buffer | null> {
  if (!/^[a-f0-9]{64}$/.test(sha)) return null;
  try {
    return await readFile(join(dir(), "uploads", sha));
  } catch {
    return null;
  }
}
