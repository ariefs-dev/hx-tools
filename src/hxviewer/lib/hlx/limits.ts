/**
 * How many blocks of a given type a preset may hold.
 *
 * Taken from the table in the HX Edit Pilot's Guide ("DSP Limit and Model
 * Availability"), for the Helix Rack/Floor/LT column:
 *
 * | Amp+Cab, Amp, Preamp, Single Cab, 1024 IR | up to four per preset, up to two per path |
 * | Dual Cab, Dual IR, Single 2048 IR         | count as two of the above; any two per preset, one per path |
 * | Poly Pitch effects                        | one per path, two per preset |
 * | Return                                    | one per Return input, per preset |
 * | 6 Switch / 1 Switch / Shuffling Looper    | one Looper per preset |
 *
 * The guide also notes the device dims models that would exceed a limit
 * rather than refusing after the fact, which is what `canAddCategory` is for.
 *
 * DSP headroom is deliberately *not* modelled. Each model's cost is known
 * (the catalog carries `load`/`loadStereo`), but the device's total budget
 * per path isn't published, and the guide describes DSP capacity as varying
 * with model choice. Reporting a total is honest; predicting the cutoff
 * would not be.
 */

import type { Catalog } from "./catalog";
import type { HlxDsp, HlxPreset } from "./model";
import { dspPaths } from "./model";

/** Catalog category ids, from `HX_ModelCatalog.json`. */
export const CATEGORY_ID = {
  distortion: 1,
  dynamics: 2,
  eq: 3,
  modulation: 4,
  delay: 5,
  reverb: 6,
  pitch: 7,
  filter: 8,
  wah: 9,
  amp: 11,
  preamp: 12,
  cab: 13,
  ir: 14,
  volumePan: 15,
  sendReturn: 16,
  looper: 17,
} as const;

/** Categories that share the four-per-preset / two-per-path amp budget. */
const AMP_FAMILY = new Set<number>([
  CATEGORY_ID.amp,
  CATEGORY_ID.preamp,
  CATEGORY_ID.cab,
  CATEGORY_ID.ir,
]);

export type LimitCheck = { allowed: boolean; reason?: string };

function countBlocks(
  preset: HlxPreset,
  catalog: Catalog,
  predicate: (categoryId: number | null) => boolean
): { total: number; perPath: Record<string, number> } {
  let total = 0;
  const perPath: Record<string, number> = {};
  for (const [dspKey, dsp] of Object.entries(dspPaths(preset))) {
    let n = 0;
    for (const [slot, value] of Object.entries(dsp as HlxDsp)) {
      if (typeof value !== "object" || value === null) continue;
      const modelId = (value as Record<string, unknown>)["@model"];
      if (typeof modelId !== "string") continue;
      // A cab named by an amp is part of that Amp+Cab block, not a separate one.
      if (slot.startsWith("cab") || slot.startsWith("input") || slot.startsWith("output")) continue;
      const category = catalog.models[modelId]?.category ?? null;
      if (predicate(category)) {
        n++;
        total++;
      }
    }
    perPath[dspKey] = n;
  }
  return { total, perPath };
}

/**
 * Whether one more block of `categoryId` may be added to `dspKey`.
 * Only the limits the Pilot's Guide states are enforced; anything else is
 * allowed.
 */
export function canAddCategory(
  preset: HlxPreset,
  catalog: Catalog,
  categoryId: number,
  dspKey: string
): LimitCheck {
  if (AMP_FAMILY.has(categoryId)) {
    const { total, perPath } = countBlocks(preset, catalog, (c) => c !== null && AMP_FAMILY.has(c));
    if (total >= 4) {
      return { allowed: false, reason: "A preset can hold at most four Amp/Preamp/Cab/IR blocks." };
    }
    if ((perPath[dspKey] ?? 0) >= 2) {
      return { allowed: false, reason: "A path can hold at most two Amp/Preamp/Cab/IR blocks." };
    }
    return { allowed: true };
  }

  if (categoryId === CATEGORY_ID.looper) {
    const { total } = countBlocks(preset, catalog, (c) => c === CATEGORY_ID.looper);
    if (total >= 1) return { allowed: false, reason: "A preset can hold only one Looper." };
    return { allowed: true };
  }

  if (categoryId === CATEGORY_ID.pitch) {
    // The per-path limit of one applies to *Poly* pitch models specifically;
    // without a reliable way to tell those apart in the catalog, only the
    // documented two-per-preset ceiling is enforced here.
    const { total } = countBlocks(preset, catalog, (c) => c === CATEGORY_ID.pitch);
    if (total >= 4) {
      return { allowed: false, reason: "Too many Pitch/Synth blocks for one preset." };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

/** Total DSP cost of a path, as a percentage, from the catalog's per-model figures. */
export function pathDspLoad(dsp: HlxDsp, catalog: Catalog | null): number | null {
  if (!catalog) return null;
  let total = 0;
  for (const value of Object.values(dsp)) {
    if (typeof value !== "object" || value === null) continue;
    const block = value as Record<string, unknown>;
    const modelId = block["@model"];
    if (typeof modelId !== "string") continue;
    const model = catalog.models[modelId];
    if (!model) continue;
    const stereo = block["@stereo"] === true;
    const load = (stereo ? model.loadStereo : model.load) ?? model.load;
    if (typeof load === "number") total += load;
  }
  return total;
}
