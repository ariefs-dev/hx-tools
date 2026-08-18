/**
 * Resolves a raw preset block into what the UI should show, using the
 * imported HX Edit catalog when it's available and falling back to the
 * neutral placeholders otherwise. Components consume only this, so they
 * don't each need to branch on whether a catalog was imported.
 */

import { categorize, friendlyName, CATEGORY_LABELS, type Category } from "./categorize";
import {
  baseUnit,
  discreteOptions,
  displayScale,
  formatParamValue,
  ICON_BASE,
  type Catalog,
} from "./catalog";
import type { HlxBlock } from "./model";

/** How the UI should render an editable control for a parameter. */
export type ParamKind = "boolean" | "choice" | "number" | "readonly";

export type DisplayParam = {
  id: string;
  label: string;
  /** HX Edit's rendering (e.g. "-29.7 dB", "160 Ribbon") when resolvable. */
  display: string | null;
  /** The value straight out of the preset file. */
  raw: unknown;
  kind: ParamKind;
  /** For `choice`: the option labels, indexed by the raw value. */
  options: string[] | null;
  /** For `number`: bounds in stored units, from the catalog when known. */
  min: number | null;
  max: number | null;
  /** Multiply stored -> displayed (Drive 0.77 shows as 7.7). */
  scale: number;
  /** Unit for the edit box, in unscaled terms ("Hz", not "kHz"). */
  unit: string;
  /** True when this parameter holds a separate value per snapshot. */
  snapshotControlled: boolean;
};

export type BlockDisplay = {
  name: string;
  categoryLabel: string;
  categoryColor: string | null;
  /** Placeholder glyph key — always set, so a missing icon still renders. */
  fallbackCategory: Category;
  iconUrl: string | null;
  enabled: boolean;
  params: DisplayParam[];
  /** Keys shown in the collapsible metadata section. */
  metaKeys: string[];
  dspLoad: number | null;
};

function kindOf(raw: unknown, options: string[] | null): ParamKind {
  if (typeof raw === "boolean") return "boolean";
  if (typeof raw !== "number") return "readonly";
  return options ? "choice" : "number";
}

function formatRaw(value: unknown): string {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function describeBlock(
  block: HlxBlock,
  catalog: Catalog | null,
  /** Names of this block's parameters that are driven by the Snapshots controller. */
  snapshotControlledParams: ReadonlySet<string> = new Set()
): BlockDisplay {
  const isControlled = (id: string) => snapshotControlledParams.has(id);
  const modelId = block["@model"] as string | undefined;
  const fallbackCategory = categorize(modelId);
  const enabled = block["@enabled"] !== false;
  const entry = modelId && catalog ? catalog.models[modelId] : undefined;

  const metaKeys = Object.keys(block).filter((k) => k.startsWith("@"));

  if (!entry) {
    // No catalog (or an id it doesn't know): show every non-@ key as-is.
    const params: DisplayParam[] = Object.keys(block)
      .filter((k) => !k.startsWith("@"))
      .map((k) => ({
        id: k,
        label: k,
        display: formatRaw(block[k]),
        raw: block[k],
        kind: kindOf(block[k], null),
        options: null,
        min: null,
        max: null,
        scale: 1,
        unit: "",
        snapshotControlled: isControlled(k),
      }));
    return {
      name: friendlyName(modelId),
      categoryLabel: CATEGORY_LABELS[fallbackCategory],
      categoryColor: null,
      fallbackCategory,
      iconUrl: null,
      enabled,
      params,
      metaKeys,
      dspLoad: null,
    };
  }

  const category = entry.category != null ? catalog!.categories[String(entry.category)] : undefined;
  const isStereo = block["@stereo"] === true;

  // Catalog order is the order HX Edit lays the knobs out, so follow it and
  // append anything the preset carries that the catalog doesn't describe.
  const seen = new Set<string>();
  const params: DisplayParam[] = [];
  for (const p of entry.params) {
    if (!(p.id in block)) continue;
    seen.add(p.id);
    const raw = block[p.id];
    const options = discreteOptions(p.type, catalog!.controls);
    params.push({
      id: p.id,
      label: p.name,
      display: formatParamValue(raw, p.type, catalog!.controls) ?? formatRaw(raw),
      raw,
      kind: kindOf(raw, options),
      options,
      min: p.min,
      max: p.max,
      scale: displayScale(p.type, catalog!.controls),
      unit: baseUnit(p.type, catalog!.controls),
      snapshotControlled: isControlled(p.id),
    });
  }
  for (const key of Object.keys(block)) {
    if (key.startsWith("@") || seen.has(key)) continue;
    params.push({
      id: key,
      label: key,
      display: formatRaw(block[key]),
      raw: block[key],
      kind: kindOf(block[key], null),
      options: null,
      min: null,
      max: null,
      scale: 1,
      unit: "",
      snapshotControlled: isControlled(key),
    });
  }

  return {
    name: entry.name ?? friendlyName(modelId),
    categoryLabel: category?.name ?? CATEGORY_LABELS[fallbackCategory],
    categoryColor: category?.color ?? null,
    fallbackCategory,
    iconUrl: entry.icon ? `${ICON_BASE}/${entry.icon}` : null,
    enabled,
    params,
    metaKeys,
    dspLoad: (isStereo ? entry.loadStereo : entry.load) ?? entry.load,
  };
}
