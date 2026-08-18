/**
 * Structural types and walking helpers for a parsed .hlx preset.
 *
 * Mirrors the logic in the sibling `hx_cli/model.py` (same project, Python
 * side) — ported to TypeScript rather than shared, since this app only ever
 * reads a preset a user drops in, it doesn't need hx_cli's byte-exact
 * round-trip codec (that only matters when *writing* a file back to disk).
 *
 * A preset's signal-chain data lives at `data.tone`, alongside up to 8
 * snapshots. Each DSP path (`dsp0`, `dsp1`, ...) holds a flat dict of named
 * slots; a slot belongs to the signal chain if it has an `@model` key.
 * Ordering isn't uniform across slot kinds (verified against real Helix LT
 * preset exports):
 *
 * - `inputA`/`inputB` have no `@position` — fixed chain starts, ordered by
 *   `@input`.
 * - `outputA`/`outputB` likewise — fixed chain ends, ordered by `@output`.
 * - `cabN` slots have no `@position` either. A cab isn't independently
 *   placed — it's driven by the amp/preamp block that references it via
 *   that block's own `@cab` field, so it renders immediately after that
 *   block rather than being sorted on its own.
 * - Everything else (`blockN`, `split`, `join`, ...) carries `@position`
 *   and is sorted by it.
 */

export type HlxBlock = Record<string, unknown> & {
  "@model"?: string;
  "@enabled"?: boolean;
  "@position"?: number;
  "@cab"?: string;
  "@input"?: number;
  "@output"?: number;
  "@path"?: number;
  "@stereo"?: boolean;
};

export type HlxDsp = Record<string, unknown>;

export type HlxSnapshot = Record<string, unknown> & {
  "@name"?: string;
};

export type HlxPreset = {
  data?: {
    meta?: { name?: string; build_sha?: string };
    device?: number;
    tone?: Record<string, unknown>;
  };
};

export function presetName(preset: HlxPreset): string {
  return preset.data?.meta?.name ?? "(unnamed)";
}

export function dspPaths(preset: HlxPreset): Record<string, HlxDsp> {
  const tone = preset.data?.tone ?? {};
  const entries = Object.entries(tone).filter(
    ([key, val]) => key.startsWith("dsp") && typeof val === "object" && val !== null
  ) as [string, HlxDsp][];
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

export type OrderedBlock = { slot: string; block: HlxBlock };

function isBlock(val: unknown): val is HlxBlock {
  return typeof val === "object" && val !== null && "@model" in (val as object);
}

export function orderedBlocks(dsp: HlxDsp): OrderedBlock[] {
  const inputs: [number, string, HlxBlock][] = [];
  const outputs: [number, string, HlxBlock][] = [];
  const chain: [number, string, HlxBlock][] = [];
  const cabs = new Map<string, HlxBlock>();

  for (const [key, val] of Object.entries(dsp)) {
    if (!isBlock(val)) continue;
    if (key.startsWith("input")) {
      inputs.push([val["@input"] ?? 0, key, val]);
    } else if (key.startsWith("output")) {
      outputs.push([val["@output"] ?? 0, key, val]);
    } else if (key.startsWith("cab")) {
      cabs.set(key, val);
    } else {
      chain.push([val["@position"] ?? Infinity, key, val]);
    }
  }

  inputs.sort((a, b) => a[0] - b[0]);
  outputs.sort((a, b) => a[0] - b[0]);
  chain.sort((a, b) => a[0] - b[0]);

  const result: OrderedBlock[] = inputs.map(([, slot, block]) => ({ slot, block }));
  for (const [, slot, block] of chain) {
    result.push({ slot, block });
    const cabKey = block["@cab"];
    if (typeof cabKey === "string" && cabs.has(cabKey)) {
      result.push({ slot: cabKey, block: cabs.get(cabKey)! });
      cabs.delete(cabKey);
    }
  }
  for (const [slot, block] of cabs) {
    result.push({ slot, block });
  }
  for (const [, slot, block] of outputs) {
    result.push({ slot, block });
  }
  return result;
}

export type SnapshotEntry = { key: string; snapshot: HlxSnapshot };

export function snapshots(preset: HlxPreset): SnapshotEntry[] {
  const tone = preset.data?.tone ?? {};
  const entries: SnapshotEntry[] = Object.entries(tone)
    .filter(
      ([key, val]) =>
        key.startsWith("snapshot") &&
        typeof val === "object" &&
        val !== null &&
        "@name" in (val as object)
    )
    .map(([key, val]) => ({ key, snapshot: val as HlxSnapshot }));
  entries.sort((a, b) => Number(a.key.slice("snapshot".length)) - Number(b.key.slice("snapshot".length)));
  return entries;
}

export function parsePreset(text: string): HlxPreset {
  return JSON.parse(text) as HlxPreset;
}
