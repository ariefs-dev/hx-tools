/**
 * Snapshot state.
 *
 * A preset stores each snapshot's state twice over, and both copies have to
 * stay in step (verified across all 24 sample presets — 203 bypass entries
 * and 53 controller parameters, zero mismatches):
 *
 * - `tone.global.@current_snapshot` names the active snapshot.
 * - `tone.snapshotN.blocks[dsp][slot]` is that snapshot's bypass state for
 *   every block, and `tone.snapshotN.controllers[dsp][slot][param].@value`
 *   holds the value of any parameter assigned to the Snapshots controller.
 * - The block's own `@enabled` and parameter values at the top level mirror
 *   whichever snapshot is currently active.
 *
 * So editing only the top level — as this app did before snapshots were
 * supported — leaves the active snapshot's stored copy stale, and the change
 * is undone the moment the hardware recalls that snapshot. Every edit here
 * writes both places.
 *
 * Snapshot `@tempo` is deliberately left alone: it does not track
 * `global.@tempo` in real presets (bingo has snapshots at 120 while global
 * is 63.8), so it isn't a mirror of the active state.
 */

import type { HlxBlock, HlxPreset } from "./model";

type ParamEntry = { "@value"?: number; "@fs_enabled"?: boolean };

/**
 * `controllers` is keyed by container, and containers come in two shapes:
 * a DSP path nests `block -> param -> entry` (`controllers.dsp0.block6.Time`),
 * while a device container holds parameters directly
 * (`controllers.variax.@variax_model`). Both appear in real presets, so the
 * level is detected from the value rather than assumed from the key.
 */
type ControllerContainer = Record<string, ParamEntry | Record<string, ParamEntry>>;

type SnapshotBody = {
  "@name"?: string;
  "@custom_name"?: boolean;
  blocks?: Record<string, Record<string, boolean>>;
  controllers?: Record<string, ControllerContainer>;
};

function isParamEntry(value: unknown): value is ParamEntry {
  return typeof value === "object" && value !== null && "@value" in value;
}

function tone(preset: HlxPreset): Record<string, unknown> | undefined {
  return preset.data?.tone as Record<string, unknown> | undefined;
}

export function currentSnapshotIndex(preset: HlxPreset): number | null {
  const global = tone(preset)?.global as Record<string, unknown> | undefined;
  const value = global?.["@current_snapshot"];
  return typeof value === "number" ? value : null;
}

function snapshotBody(preset: HlxPreset, index: number): SnapshotBody | undefined {
  return tone(preset)?.[`snapshot${index}`] as SnapshotBody | undefined;
}

/**
 * Make `index` the active snapshot, pushing its stored bypass states and
 * controller values back onto the blocks themselves.
 */
export function selectSnapshot(preset: HlxPreset, index: number): void {
  const t = tone(preset);
  const snapshot = snapshotBody(preset, index);
  if (!t || !snapshot) throw new Error(`No such snapshot: ${index}`);

  const global = t.global as Record<string, unknown> | undefined;
  if (global) global["@current_snapshot"] = index;

  for (const [dspKey, blocks] of Object.entries(snapshot.blocks ?? {})) {
    const dsp = t[dspKey] as Record<string, HlxBlock> | undefined;
    if (!dsp) continue;
    for (const [slot, enabled] of Object.entries(blocks)) {
      const block = dsp[slot];
      if (block && "@enabled" in block) block["@enabled"] = enabled;
    }
  }

  for (const [containerKey, container] of Object.entries(snapshot.controllers ?? {})) {
    const target = t[containerKey] as Record<string, unknown> | undefined;
    if (!target) continue;
    for (const [key, value] of Object.entries(container)) {
      if (isParamEntry(value)) {
        // Device container: the parameter lives directly on the container.
        if (key in target && typeof value["@value"] === "number") target[key] = value["@value"];
        continue;
      }
      // DSP container: one more level down to the block.
      const block = target[key] as HlxBlock | undefined;
      if (!block || typeof block !== "object") continue;
      for (const [param, entry] of Object.entries(value)) {
        if (isParamEntry(entry) && param in block && typeof entry["@value"] === "number") {
          block[param] = entry["@value"];
        }
      }
    }
  }
}

/** Record a block's bypass state into the active snapshot as well. */
export function syncBlockEnabled(
  preset: HlxPreset,
  dspKey: string,
  slot: string,
  enabled: boolean
): void {
  const index = currentSnapshotIndex(preset);
  if (index === null) return;
  const snapshot = snapshotBody(preset, index);
  const blocks = snapshot?.blocks?.[dspKey];
  // Only update an entry the snapshot already tracks — adding one would
  // change which blocks the snapshot controls.
  if (blocks && slot in blocks) blocks[slot] = enabled;
}

/**
 * True when a parameter holds a separate value per snapshot rather than one
 * shared value.
 *
 * That happens for any *controller-assigned* parameter, not just ones on the
 * Snapshots controller: the Owner's Manual lists a snapshot as capturing "the
 * values of any parameters assigned to controllers (up to 64 per preset)".
 * The assignment itself lives in `tone.controller[dsp][block][param]`, whose
 * `@controller` field names the physical control (1 and 2 are the expression
 * pedals; 19 is what phelix writes when it assigns every parameter to
 * Snapshots). This app reads assignments but never creates them.
 */
export function isSnapshotControlled(
  preset: HlxPreset,
  dspKey: string,
  slot: string,
  param: string
): boolean {
  return paramEntry(preset, dspKey, slot, param) !== null;
}

/** The active snapshot's stored entry for a block parameter, if it has one. */
function paramEntry(
  preset: HlxPreset,
  dspKey: string,
  slot: string,
  param: string
): ParamEntry | null {
  const index = currentSnapshotIndex(preset);
  if (index === null) return null;
  const block = snapshotBody(preset, index)?.controllers?.[dspKey]?.[slot];
  if (!block || isParamEntry(block)) return null;
  const entry = (block as Record<string, ParamEntry>)[param];
  return isParamEntry(entry) ? entry : null;
}

/** Record a snapshot-controlled parameter's value into the active snapshot. */
export function syncParamValue(
  preset: HlxPreset,
  dspKey: string,
  slot: string,
  param: string,
  value: number | boolean
): void {
  if (typeof value !== "number") return;
  const entry = paramEntry(preset, dspKey, slot, param);
  if (entry) entry["@value"] = value;
}

export type SnapshotSummary = {
  index: number;
  key: string;
  name: string;
  active: boolean;
  /** Blocks this snapshot switches on, out of those it tracks. */
  blocksOn: number;
  blocksTracked: number;
};

export function summarizeSnapshots(preset: HlxPreset): SnapshotSummary[] {
  const t = tone(preset);
  if (!t) return [];
  const active = currentSnapshotIndex(preset);
  const out: SnapshotSummary[] = [];
  for (const [key, value] of Object.entries(t)) {
    if (!key.startsWith("snapshot")) continue;
    const body = value as SnapshotBody;
    if (!body || typeof body !== "object" || !("@name" in body)) continue;
    const index = Number(key.slice("snapshot".length));
    let on = 0;
    let tracked = 0;
    for (const blocks of Object.values(body.blocks ?? {})) {
      for (const enabled of Object.values(blocks)) {
        tracked++;
        if (enabled) on++;
      }
    }
    out.push({
      index,
      key,
      name: body["@name"] ?? key,
      active: index === active,
      blocksOn: on,
      blocksTracked: tracked,
    });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}
