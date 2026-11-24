// What a vision model reads from the bundled sample drawings (public/samples),
// keyed by SHA-256 of the file. Lets the demo run offline. Confidence is lower
// where a value is inferred from the views rather than printed in the title block.
import type { Extraction } from "./extract.ts";

const f = <T>(value: T, confidence: number) => ({ value, confidence });

export const SAMPLE_EXTRACTIONS: Record<string, Extraction> = {
  // motor-mount-bracket.png
  "78d430651bd8f6c60b3d98be793877572c5c8421d6a9b46b543ead5e71474b35": {
    partName: f("Motor mount bracket", 0.98),
    process: f("sheet", 0.93),
    material: f("al-5052", 0.95),
    lengthMm: f(120, 0.96),
    widthMm: f(80, 0.96),
    heightMm: f(3, 0.9),
    quantity: f(25, 0.97),
    finish: f("powder", 0.94),
    tolerance: f("standard", 0.9),
    holes: f(6, 0.88),
    bends: f(2, 0.66),
  },
  // bearing-flange.png
  "c6612e0c1956a71cc7707f4eafffd3b7fd6c31f06aedbd9ac39f23881c7a5a6c": {
    partName: f("Bearing flange", 0.98),
    process: f("cnc", 0.95),
    material: f("ss-304", 0.96),
    lengthMm: f(90, 0.95),
    widthMm: f(90, 0.95),
    heightMm: f(18, 0.92),
    quantity: f(10, 0.97),
    finish: f("passivate", 0.95),
    tolerance: f("precision", 0.91),
    holes: f(6, 0.71),
    bends: f(0, 0.95),
  },
  // drive-shaft-spacer.png
  "f7b19fb574f42642f629525796b6d2520cf3d8bf2562e54812f40e116fac08c2": {
    partName: f("Drive shaft spacer", 0.97),
    process: f("cnc", 0.94),
    material: f("brass-360", 0.95),
    lengthMm: f(40, 0.93),
    widthMm: f(40, 0.93),
    heightMm: f(25, 0.9),
    quantity: f(100, 0.97),
    finish: f("none", 0.9),
    tolerance: f("tight", 0.89),
    holes: f(1, 0.85),
    bends: f(0, 0.96),
  },
};
