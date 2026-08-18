/**
 * Lays a DSP path out the way the Helix Home screen draws it: a grid of slots
 * with an upper row A and a lower row B, rather than the flat list the editor
 * view uses.
 *
 * Each path is "either parallel (A and B) or serial (A only)" (Owner's
 * Manual, Home Screen). `@path` picks the row — 0 = A, 1 = B — and
 * `@position` picks the column. Split and merge blocks carry a position but
 * no `@path`, since they sit on the spine between the rows; inputs and
 * outputs carry neither and are pinned to the ends.
 */

import type { HlxBlock, HlxDsp } from "./model";

export type GridEntry = { slot: string; block: HlxBlock };

export type PathGrid = {
  dspKey: string;
  /** Number of slot columns, i.e. highest @position + 1. */
  columns: number;
  rowA: (GridEntry | null)[];
  rowB: (GridEntry | null)[];
  /** True when anything actually sits on row B (a parallel path). */
  parallel: boolean;
  inputs: GridEntry[];
  outputs: GridEntry[];
  /** Column index of the split / merge blocks, when present. */
  splitColumn: number | null;
  joinColumn: number | null;
};

function isBlock(value: unknown): value is HlxBlock {
  return typeof value === "object" && value !== null && "@model" in (value as object);
}

export function buildGrid(dspKey: string, dsp: HlxDsp): PathGrid {
  const inputs: { order: number; entry: GridEntry }[] = [];
  const outputs: { order: number; entry: GridEntry }[] = [];
  const placed: { path: number; position: number; entry: GridEntry }[] = [];
  const cabs = new Map<string, GridEntry>();
  let splitColumn: number | null = null;
  let joinColumn: number | null = null;
  let maxPosition = -1;

  for (const [slot, value] of Object.entries(dsp)) {
    if (!isBlock(value)) continue;
    const entry: GridEntry = { slot, block: value };

    if (slot.startsWith("input")) {
      inputs.push({ order: (value["@input"] as number) ?? 0, entry });
      continue;
    }
    if (slot.startsWith("output")) {
      outputs.push({ order: (value["@output"] as number) ?? 0, entry });
      continue;
    }
    if (slot.startsWith("cab")) {
      cabs.set(slot, entry);
      continue;
    }

    const position = value["@position"];
    if (typeof position !== "number") continue;
    maxPosition = Math.max(maxPosition, position);

    if (slot === "split") {
      splitColumn = position;
      continue;
    }
    if (slot === "join") {
      joinColumn = position;
      continue;
    }
    placed.push({ path: (value["@path"] as number) ?? 0, position, entry });
  }

  const columns = maxPosition + 1;
  const rowA: (GridEntry | null)[] = Array(Math.max(columns, 0)).fill(null);
  const rowB: (GridEntry | null)[] = Array(Math.max(columns, 0)).fill(null);
  for (const { path, position, entry } of placed) {
    const row = path === 1 ? rowB : rowA;
    row[position] = entry;
  }

  // A cab isn't independently placed — it belongs to the amp that names it
  // via @cab, so the hardware draws them as one Amp+Cab slot. Attach it so
  // the renderer can label the amp accordingly.
  for (const { entry } of placed) {
    const cabKey = entry.block["@cab"];
    if (typeof cabKey === "string" && cabs.has(cabKey)) {
      (entry as GridEntry & { cab?: GridEntry }).cab = cabs.get(cabKey);
    }
  }

  inputs.sort((a, b) => a.order - b.order);
  outputs.sort((a, b) => a.order - b.order);

  return {
    dspKey,
    columns: Math.max(columns, 0),
    rowA,
    rowB,
    parallel: rowB.some(Boolean),
    inputs: inputs.map((i) => i.entry),
    outputs: outputs.map((o) => o.entry),
    splitColumn,
    joinColumn,
  };
}

export type FootswitchEntry = {
  dspKey: string;
  slot: string;
  label: string;
  index: number;
  enabled: boolean;
  momentary: boolean;
};

/**
 * Blocks bound to a Stomp-mode footswitch, in `@fs_index` order.
 *
 * `@fs_index` is *not* used as a physical switch number here: real presets
 * show values from 2 to 18 across a device with eight switches, and the
 * index-to-control mapping isn't publicly documented (the fretwire protocol
 * notes flag the same gap). Order is all that's claimed.
 */
export function footswitches(preset: {
  data?: { tone?: Record<string, unknown> };
}): FootswitchEntry[] {
  const table = preset.data?.tone?.footswitch as
    | Record<string, Record<string, Record<string, unknown>>>
    | undefined;
  if (!table) return [];
  const out: FootswitchEntry[] = [];
  for (const [dspKey, blocks] of Object.entries(table)) {
    for (const [slot, meta] of Object.entries(blocks)) {
      if (typeof meta !== "object" || meta === null) continue;
      out.push({
        dspKey,
        slot,
        label: (meta["@fs_label"] as string) ?? slot,
        index: (meta["@fs_index"] as number) ?? 0,
        enabled: meta["@fs_enabled"] === true,
        momentary: meta["@fs_momentary"] === true,
      });
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}
