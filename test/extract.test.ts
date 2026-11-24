import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { lineSchema, fieldsNeedingReview } from "../lib/schemas.ts";
import { extractionSchema, extractionToLine, SampleExtractor, sniffImage } from "../lib/extract.ts";
import { SAMPLE_EXTRACTIONS } from "../lib/samples.ts";

test("sample extractions match the bundled drawings and the schema", async () => {
  for (const f of ["motor-mount-bracket", "bearing-flange", "drive-shaft-spacer"]) {
    const bytes = readFileSync(new URL(`../public/samples/${f}.png`, import.meta.url));
    const sha = createHash("sha256").update(bytes).digest("hex");
    assert.ok(SAMPLE_EXTRACTIONS[sha], `no sample extraction for ${f}`);
    extractionSchema.parse(SAMPLE_EXTRACTIONS[sha]);
    assert.equal(sniffImage(bytes), "image/png");
  }
});

test("low-confidence fields need review", async () => {
  const ex = new SampleExtractor(SAMPLE_EXTRACTIONS);
  const e = await ex.extract({ sha256: "78d430651bd8f6c60b3d98be793877572c5c8421d6a9b46b543ead5e71474b35", filename: "x.png" });
  const l = lineSchema.parse(extractionToLine(e, "l1", "78d430651bd8f6c60b3d98be793877572c5c8421d6a9b46b543ead5e71474b35"));
  assert.equal(l.reviewed, false);
  assert.deepEqual(fieldsNeedingReview(l), ["bends"]);
  const unknown = await ex.extract({ sha256: "0".repeat(64), filename: "custom_plate.jpg" });
  assert.equal(unknown.partName.value, "custom plate");
  assert.equal(sniffImage(new TextEncoder().encode("<svg>")), null);
});
