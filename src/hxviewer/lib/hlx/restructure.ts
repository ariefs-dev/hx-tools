/**
 * Structural edits: moving a block along its path, and swapping its model.
 *
 * Both are constrained by rules derived from the real presets in
 * `src/vendor/phelix/presets` (24 presets, 48 DSP paths):
 *
 * - `@position` is an index *within a path branch*, not a global one. Two
 *   blocks legitimately share a position when their `@path` differs (0 = the
 *   upper branch A, 1 = the lower branch B), and `(@path, @position)` was
 *   unique in every path examined. Moving a block therefore means exchanging
 *   `@position` with its neighbour on the same branch: the set of occupied
 *   slots is unchanged, so split/join routing can't be invalidated.
 * - Structural keys travel with the block's *category*, not its model:
 *   `@trails` appears only on Delay/Reverb, `@bypassvolume` and `@cab` only
 *   on Amp, and Amp blocks carry no `@stereo` at all (amps are mono — see the
 *   Owner's Manual on block order and stereo imaging). A cross-category swap
 *   would have to synthesize or drop those keys, so swapping is restricted to
 *   models within the same category, where the shape is already correct.
 */

import type { Catalog } from "./catalog";
import { canAddCategory, CATEGORY_ID, type LimitCheck } from "./limits";
import type { HlxBlock, HlxDsp, HlxPreset } from "./model";

export type MoveDirection = "earlier" | "later";

function dspOf(preset: HlxPreset, dspKey: string): HlxDsp {
  const dsp = preset.data?.tone?.[dspKey] as HlxDsp | undefined;
  if (!dsp) throw new Error(`No such DSP path: ${dspKey}`);
  return dsp;
}

function blockOf(dsp: HlxDsp, slot: string): HlxBlock {
  const block = dsp[slot] as HlxBlock | undefined;
  if (!block) throw new Error(`No such block: ${slot}`);
  return block;
}

/** Slots on the same branch as `slot`, ordered by position. */
function branchSlots(dsp: HlxDsp, path: number): { slot: string; block: HlxBlock }[] {
  const out: { slot: string; block: HlxBlock; pos: number }[] = [];
  for (const [key, value] of Object.entries(dsp)) {
    if (typeof value !== "object" || value === null) continue;
    const block = value as HlxBlock;
    if (!("@model" in block)) continue;
    if (block["@path"] !== path) continue;
    if (typeof block["@position"] !== "number") continue;
    out.push({ slot: key, block, pos: block["@position"] });
  }
  out.sort((a, b) => a.pos - b.pos);
  return out.map(({ slot, block }) => ({ slot, block }));
}

export function canMoveBlock(dsp: HlxDsp, slot: string, direction: MoveDirection): boolean {
  const block = dsp[slot] as HlxBlock | undefined;
  if (!block || typeof block["@path"] !== "number" || typeof block["@position"] !== "number") {
    return false;
  }
  const siblings = branchSlots(dsp, block["@path"]);
  const index = siblings.findIndex((s) => s.slot === slot);
  if (index < 0) return false;
  return direction === "earlier" ? index > 0 : index < siblings.length - 1;
}

/**
 * Move a block one slot along its branch by exchanging `@position` with its
 * neighbour. Both blocks keep their `@path`, so the occupied slot set is
 * untouched.
 */
export function moveBlock(
  preset: HlxPreset,
  dspKey: string,
  slot: string,
  direction: MoveDirection
): void {
  const dsp = dspOf(preset, dspKey);
  const block = blockOf(dsp, slot);
  const path = block["@path"];
  if (typeof path !== "number") throw new Error(`${slot} has no @path and can't be moved`);

  const siblings = branchSlots(dsp, path);
  const index = siblings.findIndex((s) => s.slot === slot);
  const neighbourIndex = direction === "earlier" ? index - 1 : index + 1;
  if (index < 0 || neighbourIndex < 0 || neighbourIndex >= siblings.length) {
    throw new Error(`${slot} is already at the ${direction === "earlier" ? "start" : "end"}`);
  }

  const neighbour = siblings[neighbourIndex].block;
  const own = block["@position"];
  block["@position"] = neighbour["@position"];
  neighbour["@position"] = own;
}

export type SwapCandidate = {
  id: string;
  name: string;
  subcategory: string | null;
};

/**
 * Models that can replace `block` without changing its structural shape:
 * everything in the same catalog category. Cross-category swaps are excluded
 * because they'd require adding or removing category-specific keys
 * (`@trails`, `@cab`, `@bypassvolume`, `@stereo`).
 */
export function swapCandidates(block: HlxBlock, catalog: Catalog | null): SwapCandidate[] {
  const modelId = block["@model"];
  if (!catalog || typeof modelId !== "string") return [];
  const current = catalog.models[modelId];
  if (!current || current.category == null) return [];

  const out: SwapCandidate[] = [];
  for (const [id, model] of Object.entries(catalog.models)) {
    if (model.category !== current.category) continue;
    if (!model.name) continue;
    out.push({ id, name: model.name, subcategory: model.subcategory });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * Replace a block's model, resetting its parameters to the new model's
 * factory defaults — the same thing HX Edit does when you pick a new model
 * in a slot.
 *
 * Routing and block-level state (`@position`, `@path`, `@enabled`, `@type`,
 * `@cab`, `@no_snapshot_bypass`) is preserved; only the model and its
 * parameters change.
 */
export function swapModel(
  preset: HlxPreset,
  dspKey: string,
  slot: string,
  newModelId: string,
  catalog: Catalog
): void {
  const dsp = dspOf(preset, dspKey);
  const block = blockOf(dsp, slot);
  const currentId = block["@model"];
  const target = catalog.models[newModelId];
  if (!target) throw new Error(`Unknown model: ${newModelId}`);
  if (typeof currentId !== "string") throw new Error(`${slot} has no @model`);

  const current = catalog.models[currentId];
  if (current && current.category !== target.category) {
    throw new Error(
      "Swapping across categories isn't supported — the block's structural keys differ."
    );
  }

  const targetParams = new Map(target.params.map((p) => [p.id, p]));

  // Drop the outgoing model's parameters; '@' keys are block state, not
  // model state, so they stay.
  for (const key of Object.keys(block)) {
    if (key.startsWith("@")) continue;
    if (!targetParams.has(key)) delete block[key];
  }

  for (const p of target.params) {
    if (p.default === null) continue;
    if (p.id.startsWith("@")) {
      // Category-specific block settings (@trails, @bypassvolume, @mic):
      // only fill them in if the block doesn't already carry the key, so a
      // user's existing setting survives the swap.
      if (!(p.id in block)) block[p.id] = p.default;
    } else {
      block[p.id] = p.default;
    }
  }

  block["@model"] = newModelId;

  // A mono-only model can't sit in a stereo slot.
  if (block["@stereo"] === true && target.stereo === false) block["@stereo"] = false;
}

/**
 * Categories `addBlock` can create as an ordinary single-slot block.
 *
 * Amps and Preamps go through `addAmpCab` instead, since an Amp+Cab is two
 * linked slots with a different key set. Standalone Cab and IR blocks are
 * still excluded: a Cab block's shape differs again (no `@stereo`), and an IR
 * block carries an `@uuid` pointing into the user's own IR library, which
 * can't be synthesized here.
 */
const ADDABLE_CATEGORIES: number[] = [
  CATEGORY_ID.distortion,
  CATEGORY_ID.dynamics,
  CATEGORY_ID.eq,
  CATEGORY_ID.modulation,
  CATEGORY_ID.delay,
  CATEGORY_ID.reverb,
  CATEGORY_ID.pitch,
  CATEGORY_ID.filter,
  CATEGORY_ID.wah,
  CATEGORY_ID.volumePan,
  CATEGORY_ID.looper,
];

export function isAddableCategory(categoryId: number | null | undefined): boolean {
  return categoryId != null && ADDABLE_CATEGORIES.includes(categoryId);
}

/** Every model that can be added, grouped for a picker. */
export function addableModels(catalog: Catalog | null): SwapCandidate[] {
  if (!catalog) return [];
  const out: SwapCandidate[] = [];
  for (const [id, model] of Object.entries(catalog.models)) {
    if (!model.name || !isAddableCategory(model.category)) continue;
    out.push({ id, name: model.name, subcategory: model.subcategory });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** The lowest column on `path` with no block in it, or null if the row is full. */
function firstFreePosition(dsp: HlxDsp, path: number): number | null {
  const taken = new Set<number>();
  let spineMax = -1;
  for (const [slot, value] of Object.entries(dsp)) {
    if (typeof value !== "object" || value === null) continue;
    const block = value as HlxBlock;
    if (!("@model" in block)) continue;
    const position = block["@position"];
    if (typeof position !== "number") continue;
    if (slot === "split" || slot === "join") {
      spineMax = Math.max(spineMax, position);
      continue;
    }
    if (block["@path"] === path) taken.add(position);
  }
  // Stay within the columns the preset already uses; the device lays out a
  // fixed number of slots per row and we have no way to extend it safely.
  const ceiling = spineMax >= 0 ? spineMax : 8;
  for (let i = 0; i < ceiling; i++) {
    if (!taken.has(i)) return i;
  }
  return null;
}

/** The next unused `blockN` key in a path. */
function nextBlockSlot(dsp: HlxDsp): string {
  let n = 0;
  while (`block${n}` in dsp) n++;
  return `block${n}`;
}

export function canAddBlock(
  preset: HlxPreset,
  catalog: Catalog | null,
  modelId: string,
  dspKey: string,
  path: number
): LimitCheck {
  if (!catalog) return { allowed: false, reason: "No model catalog imported." };
  const model = catalog.models[modelId];
  if (!model) return { allowed: false, reason: `Unknown model: ${modelId}` };
  if (!isAddableCategory(model.category)) {
    return { allowed: false, reason: "Only effects blocks can be added here." };
  }
  const dsp = preset.data?.tone?.[dspKey] as HlxDsp | undefined;
  if (!dsp) return { allowed: false, reason: `No such DSP path: ${dspKey}` };
  if (firstFreePosition(dsp, path) === null) {
    return { allowed: false, reason: "That path has no free slot." };
  }
  return canAddCategory(preset, catalog, model.category!, dspKey);
}

/**
 * Add an effects block at the first free slot on a branch, at the model's
 * factory defaults.
 *
 * The new block is also registered in every snapshot's bypass table, because
 * "all Amp & Effects blocks' bypass state is automatically stored and
 * recalled per Snapshot" (HX Edit Pilot's Guide) — a block missing from that
 * table would not be recalled correctly.
 */
export function addBlock(
  preset: HlxPreset,
  catalog: Catalog,
  modelId: string,
  dspKey: string,
  path: number
): string {
  const check = canAddBlock(preset, catalog, modelId, dspKey, path);
  if (!check.allowed) throw new Error(check.reason ?? "Cannot add that block.");

  const dsp = preset.data!.tone![dspKey] as HlxDsp;
  const model = catalog.models[modelId];
  const position = firstFreePosition(dsp, path)!;
  const slot = nextBlockSlot(dsp);

  const block: HlxBlock = {
    "@model": modelId,
    "@position": position,
    "@path": path,
    "@type": categoryToType(model.category!),
    "@enabled": true,
    "@no_snapshot_bypass": false,
  };
  // Amps are the only category with no @stereo at all; effects always carry
  // it, and Delay/Reverb additionally carry @trails.
  block["@stereo"] = model.stereo === true && model.mono !== true ? true : false;
  if (model.category === CATEGORY_ID.delay || model.category === CATEGORY_ID.reverb) {
    block["@trails"] = false;
  }
  for (const p of model.params) {
    if (p.default === null) continue;
    block[p.id] = p.default;
  }

  (dsp as Record<string, unknown>)[slot] = block;

  for (const snapshot of Object.values(preset.data?.tone ?? {})) {
    if (typeof snapshot !== "object" || snapshot === null) continue;
    const blocks = (snapshot as { blocks?: Record<string, Record<string, boolean>> }).blocks;
    if (!blocks) continue;
    (blocks[dspKey] ??= {})[slot] = true;
  }

  return slot;
}

/** Catalog category -> the preset's `@type` field, per the routing model. */
function categoryToType(categoryId: number): number {
  switch (categoryId) {
    case CATEGORY_ID.delay:
    case CATEGORY_ID.reverb:
      return 7;
    case CATEGORY_ID.looper:
      return 6;
    case CATEGORY_ID.ir:
      return 5;
    case CATEGORY_ID.cab:
      return 2;
    default:
      return 0;
  }
}

/**
 * Remove a block, along with every reference to it: its cab (for an Amp+Cab),
 * its per-snapshot bypass entries and controller values, its preset-level
 * controller assignment, and its footswitch binding. Leaving any of those
 * behind would point at a slot that no longer exists.
 */
export function removeBlock(preset: HlxPreset, dspKey: string, slot: string): void {
  const dsp = dspOf(preset, dspKey);
  const block = blockOf(dsp, slot);

  const cabKey = block["@cab"];
  delete (dsp as Record<string, unknown>)[slot];
  if (typeof cabKey === "string") delete (dsp as Record<string, unknown>)[cabKey];

  const tone = preset.data?.tone as Record<string, unknown> | undefined;
  if (!tone) return;

  for (const [key, value] of Object.entries(tone)) {
    if (typeof value !== "object" || value === null) continue;

    if (key.startsWith("snapshot")) {
      const snap = value as {
        blocks?: Record<string, Record<string, boolean>>;
        controllers?: Record<string, Record<string, unknown>>;
      };
      pruneFrom(snap.blocks, dspKey, slot);
      pruneFrom(snap.controllers, dspKey, slot);
      continue;
    }

    if (key === "controller" || key === "footswitch") {
      pruneFrom(value as Record<string, Record<string, unknown>>, dspKey, slot);
    }
  }
}

/**
 * Drop `slot` from a per-path table, and drop the path container itself if
 * that empties it. Real presets never carry an empty container (checked
 * across every sample: 304 populated, 80 absent, 0 empty) — a path either has
 * entries or the key is absent — so leaving `{}` behind would put the file in
 * a shape the format doesn't otherwise use.
 */
function pruneFrom(
  table: Record<string, Record<string, unknown>> | undefined,
  dspKey: string,
  slot: string
): void {
  const container = table?.[dspKey];
  if (!container) return;
  delete container[slot];
  if (Object.keys(container).length === 0) delete table![dspKey];
}

/**
 * Models that can be the amp half of an Amp or Amp+Cab block, and models that
 * can be its cab half.
 */
export function ampModels(catalog: Catalog | null): SwapCandidate[] {
  return modelsInCategories(catalog, [CATEGORY_ID.amp, CATEGORY_ID.preamp]);
}

export function cabModels(catalog: Catalog | null): SwapCandidate[] {
  return modelsInCategories(catalog, [CATEGORY_ID.cab]);
}

function modelsInCategories(catalog: Catalog | null, categories: number[]): SwapCandidate[] {
  if (!catalog) return [];
  const wanted = new Set(categories);
  const out: SwapCandidate[] = [];
  for (const [id, model] of Object.entries(catalog.models)) {
    if (model.category == null || !wanted.has(model.category) || !model.name) continue;
    out.push({ id, name: model.name, subcategory: model.subcategory });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** The next unused `cabN` key in a path. */
function nextCabSlot(dsp: HlxDsp): string {
  let n = 0;
  while (`cab${n}` in dsp) n++;
  return `cab${n}`;
}

export function canAddAmp(
  preset: HlxPreset,
  catalog: Catalog | null,
  ampModelId: string,
  dspKey: string,
  path: number
): LimitCheck {
  if (!catalog) return { allowed: false, reason: "No model catalog imported." };
  const model = catalog.models[ampModelId];
  if (!model) return { allowed: false, reason: `Unknown model: ${ampModelId}` };
  if (model.category !== CATEGORY_ID.amp && model.category !== CATEGORY_ID.preamp) {
    return { allowed: false, reason: "That model isn't an Amp or Preamp." };
  }
  const dsp = preset.data?.tone?.[dspKey] as HlxDsp | undefined;
  if (!dsp) return { allowed: false, reason: `No such DSP path: ${dspKey}` };
  if (firstFreePosition(dsp, path) === null) {
    return { allowed: false, reason: "That path has no free slot." };
  }
  return canAddCategory(preset, catalog, CATEGORY_ID.amp, dspKey);
}

/**
 * Add an Amp, or an Amp+Cab, at the first free slot on a branch.
 *
 * An Amp+Cab is two linked slots, and the shape is not the same as an
 * effects block — verified identical across all 18 Amp+Cab blocks in the
 * sample presets:
 *
 * - the amp lives in a `blockN` slot carrying `@bypassvolume` and, when it
 *   has a cab, `@cab` naming that cab's slot. `@type` is **3** with a cab and
 *   **1** without. An amp carries **no `@stereo`** at all (amps are mono).
 * - the cab lives in its own `cabN` slot holding only `@model`, `@enabled`
 *   and its parameters (`@mic` among them, for the 41 of 133 cab models that
 *   have one). It has no `@position`, `@path` or `@type`: it isn't placed in
 *   the chain independently, the amp that names it decides where it sits.
 * - only the amp is registered in the snapshots' bypass tables. Cab slots
 *   appear there **zero** times across the samples (against 1528 `blockN`
 *   references), because bypassing an Amp+Cab bypasses the pair.
 */
export function addAmpCab(
  preset: HlxPreset,
  catalog: Catalog,
  ampModelId: string,
  cabModelId: string | null,
  dspKey: string,
  path: number
): string {
  const check = canAddAmp(preset, catalog, ampModelId, dspKey, path);
  if (!check.allowed) throw new Error(check.reason ?? "Cannot add that amp.");

  const amp = catalog.models[ampModelId];
  const cab = cabModelId ? catalog.models[cabModelId] : null;
  if (cabModelId && !cab) throw new Error(`Unknown cab model: ${cabModelId}`);
  if (cab && cab.category !== CATEGORY_ID.cab) {
    throw new Error("That model isn't a Cab.");
  }

  const dsp = preset.data!.tone![dspKey] as HlxDsp;
  const position = firstFreePosition(dsp, path)!;
  const slot = nextBlockSlot(dsp);

  const block: HlxBlock = {
    "@model": ampModelId,
    "@position": position,
    "@path": path,
    "@type": cab ? 3 : 1,
    "@enabled": true,
    "@no_snapshot_bypass": false,
  };
  // @bypassvolume arrives with the catalog params below, as do the tone
  // controls; deliberately no @stereo.
  for (const p of amp.params) {
    if (p.default !== null) block[p.id] = p.default;
  }

  if (cab && cabModelId) {
    const cabSlot = nextCabSlot(dsp);
    block["@cab"] = cabSlot;
    const cabBlock: HlxBlock = { "@model": cabModelId, "@enabled": true };
    for (const p of cab.params) {
      if (p.default !== null) cabBlock[p.id] = p.default;
    }
    (dsp as Record<string, unknown>)[cabSlot] = cabBlock;
  }

  (dsp as Record<string, unknown>)[slot] = block;

  for (const snapshot of Object.values(preset.data?.tone ?? {})) {
    if (typeof snapshot !== "object" || snapshot === null) continue;
    const blocks = (snapshot as { blocks?: Record<string, Record<string, boolean>> }).blocks;
    if (!blocks) continue;
    (blocks[dspKey] ??= {})[slot] = true;
  }

  return slot;
}

/**
 * Attach, replace, or detach the cab on an existing Amp block, keeping
 * `@type` consistent (3 with a cab, 1 without).
 */
export function setAmpCab(
  preset: HlxPreset,
  catalog: Catalog,
  dspKey: string,
  slot: string,
  cabModelId: string | null
): void {
  const dsp = dspOf(preset, dspKey);
  const block = blockOf(dsp, slot);
  const existing = block["@cab"];

  if (!cabModelId) {
    if (typeof existing === "string") delete (dsp as Record<string, unknown>)[existing];
    delete block["@cab"];
    block["@type"] = 1;
    return;
  }

  const cab = catalog.models[cabModelId];
  if (!cab || cab.category !== CATEGORY_ID.cab) throw new Error("That model isn't a Cab.");

  const cabSlot = typeof existing === "string" ? existing : nextCabSlot(dsp);
  const previous = (dsp as Record<string, HlxBlock>)[cabSlot];
  const cabBlock: HlxBlock = { "@model": cabModelId, "@enabled": previous?.["@enabled"] ?? true };
  for (const p of cab.params) {
    if (p.default !== null) cabBlock[p.id] = p.default;
  }
  (dsp as Record<string, unknown>)[cabSlot] = cabBlock;
  block["@cab"] = cabSlot;
  block["@type"] = 3;
}
