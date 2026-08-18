/**
 * Best-effort category + display name for a raw `@model` id (e.g.
 * "HD2_AmpLine6Fatality"), with no bundled Line 6 model catalog.
 *
 * This app ships no official model names, parameter catalog, or artwork —
 * see the README for why (the same pattern as every other community Helix
 * editor we looked at: fretwire, openpodgo). Category is inferred from the
 * id's own prefix (Helix's model ids consistently start with their category,
 * e.g. "Amp", "Dist", "Pitch"), and the display name is just the id with
 * camelCase split into words. If the user imports their own HX Edit
 * resources (see `resImport.ts`), those real names/icons take over instead.
 */

export type Category =
  | "amp"
  | "cab"
  | "distortion"
  | "dynamics"
  | "eq"
  | "filter"
  | "wah"
  | "pitch"
  | "reverb"
  | "delay"
  | "modulation"
  | "volumePan"
  | "sendReturn"
  | "looper"
  | "input"
  | "output"
  | "split"
  | "join"
  | "other";

const CATEGORY_PREFIXES: [string, Category][] = [
  ["AppDSPFlow1Input", "input"],
  ["AppDSPFlow2Input", "input"],
  ["AppDSPFlowInput", "input"],
  ["AppDSPFlowOutput", "output"],
  ["AppDSPFlowSplit", "split"],
  ["AppDSPFlowJoin", "join"],
  ["Amp", "amp"],
  ["Cab", "cab"],
  ["Dist", "distortion"],
  ["Dynamics", "dynamics"],
  ["Comp", "dynamics"],
  ["EQ", "eq"],
  ["Filter", "filter"],
  ["Wah", "wah"],
  ["Pitch", "pitch"],
  ["Synth", "pitch"],
  ["Reverb", "reverb"],
  ["Delay", "delay"],
  ["Vibrato", "modulation"],
  ["Chorus", "modulation"],
  ["Flange", "modulation"],
  ["Phase", "modulation"],
  ["Rotary", "modulation"],
  ["Tremolo", "modulation"],
  ["Mod", "modulation"],
  ["Volume", "volumePan"],
  ["Pan", "volumePan"],
  ["Send", "sendReturn"],
  ["Return", "sendReturn"],
  ["Looper", "looper"],
];

export function stripModelPrefix(modelId: string): string {
  return modelId.startsWith("HD2_") ? modelId.slice("HD2_".length) : modelId;
}

export function categorize(modelId: string | undefined): Category {
  if (!modelId) return "other";
  const stripped = stripModelPrefix(modelId);
  for (const [prefix, category] of CATEGORY_PREFIXES) {
    if (stripped.startsWith(prefix)) return category;
  }
  return "other";
}

export function friendlyName(modelId: string | undefined): string {
  if (!modelId) return "(no model)";
  const stripped = stripModelPrefix(modelId);
  const spaced = stripped
    // split before an uppercase letter that follows a lowercase letter or digit
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // split a run of digits away from a following uppercase word (e.g. "Line6Fatality")
    .replace(/([0-9])([A-Z])/g, "$1 $2");
  return spaced.trim();
}

export const CATEGORY_LABELS: Record<Category, string> = {
  amp: "Amp",
  cab: "Cab",
  distortion: "Distortion",
  dynamics: "Dynamics",
  eq: "EQ",
  filter: "Filter",
  wah: "Wah",
  pitch: "Pitch/Synth",
  reverb: "Reverb",
  delay: "Delay",
  modulation: "Modulation",
  volumePan: "Volume/Pan",
  sendReturn: "Send/Return",
  looper: "Looper",
  input: "Input",
  output: "Output",
  split: "Split",
  join: "Join",
  other: "Other",
};
