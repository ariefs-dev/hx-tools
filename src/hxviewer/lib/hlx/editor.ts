/**
 * Editing operations over a loaded preset, plus export.
 *
 * A loaded preset keeps three things together: the parsed data, the original
 * file text, and the key-order table from `parseOrdered`. Holding the
 * original text lets us verify — before the user ever downloads anything —
 * that re-encoding an *unedited* preset reproduces the source byte for byte.
 * If that check fails, this codec doesn't fully understand the file and the
 * UI says so rather than silently handing back a rewritten preset.
 *
 * Edits mutate the parsed tree in place. The tree is large and edits are
 * pointwise, so cloning it on every slider movement would be wasteful; the
 * React layer instead bumps a revision counter to trigger re-renders.
 */

import { encode, type Json } from "./codec";
import { parseOrdered, type KeyOrder } from "./parse";
import { syncBlockEnabled, syncParamValue } from "./snapshots";
import type { HlxBlock, HlxPreset } from "./model";

export type LoadedPreset = {
  data: HlxPreset;
  order: KeyOrder;
  originalText: string;
  filename: string;
  /** True when an unedited re-encode reproduces `originalText` exactly. */
  roundTrips: boolean;
};

export function loadPreset(text: string, filename: string): LoadedPreset {
  const { value, order } = parseOrdered(text);
  const data = value as unknown as HlxPreset;
  if (!data?.data?.tone) {
    throw new Error("This file doesn't look like a Helix .hlx preset (missing data.tone).");
  }
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n$/, "");
  const roundTrips = encode(value, order) === normalized;
  return { data, order, originalText: text, filename, roundTrips };
}

export function serializePreset(preset: LoadedPreset): string {
  // Match the source file's line endings and trailing newline so an unedited
  // export is indistinguishable from the original.
  const usesCrLf = preset.originalText.includes("\r\n");
  const hadTrailingNewline = /\n$/.test(preset.originalText);
  let text = encode(preset.data as unknown as Json, preset.order);
  if (usesCrLf) text = text.replace(/\n/g, "\r\n");
  if (hadTrailingNewline) text += usesCrLf ? "\r\n" : "\n";
  return text;
}

export function isDirty(preset: LoadedPreset): boolean {
  return serializePreset(preset) !== preset.originalText;
}

function getBlock(preset: HlxPreset, dspKey: string, slot: string): HlxBlock {
  const dsp = preset.data?.tone?.[dspKey] as Record<string, HlxBlock> | undefined;
  const block = dsp?.[slot];
  if (!block) throw new Error(`No such block: ${dspKey}.${slot}`);
  return block;
}

/**
 * Set a parameter, coercing to the type already stored so a numeric field
 * never silently becomes a string (and a boolean field stays boolean).
 *
 * If the parameter is assigned to the Snapshots controller, the active
 * snapshot's stored copy is updated too — otherwise the hardware would undo
 * the edit as soon as it recalled that snapshot.
 */
export function setParam(
  preset: HlxPreset,
  dspKey: string,
  slot: string,
  param: string,
  value: number | boolean
): void {
  const block = getBlock(preset, dspKey, slot);
  if (!(param in block)) throw new Error(`No such parameter '${param}' on ${dspKey}.${slot}`);
  const existing = block[param];
  let next: number | boolean;
  if (typeof existing === "boolean") {
    next = Boolean(value);
  } else if (typeof existing === "number") {
    const coerced = Number(value);
    if (!Number.isFinite(coerced)) throw new Error(`Invalid value for '${param}': ${value}`);
    next = coerced;
  } else {
    next = value;
  }
  block[param] = next;
  syncParamValue(preset, dspKey, slot, param, next);
}

export function setBlockEnabled(
  preset: HlxPreset,
  dspKey: string,
  slot: string,
  enabled: boolean
): void {
  getBlock(preset, dspKey, slot)["@enabled"] = enabled;
  syncBlockEnabled(preset, dspKey, slot, enabled);
}

export function renamePreset(preset: HlxPreset, name: string): void {
  const meta = preset.data?.meta;
  if (meta) meta.name = name;
}

export function renameSnapshot(preset: HlxPreset, key: string, name: string): void {
  const snap = preset.data?.tone?.[key] as Record<string, unknown> | undefined;
  if (!snap) return;
  snap["@name"] = name;
  // Helix uses this flag to decide whether to show a custom label instead of
  // the default "SNAPSHOT n".
  snap["@custom_name"] = true;
}

/** Restore the preset to the state it was loaded in. */
export function revertPreset(preset: LoadedPreset): LoadedPreset {
  return loadPreset(preset.originalText, preset.filename);
}

export function downloadPreset(preset: LoadedPreset, filename?: string): void {
  const text = serializePreset(preset);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? preset.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
