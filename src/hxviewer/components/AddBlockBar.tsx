"use client";

import { useMemo, useState } from "react";
import type { Catalog } from "@/lib/hlx/catalog";
import type { SwapCandidate } from "@/lib/hlx/restructure";

type Verdict = { allowed: boolean; reason?: string };

/**
 * Adds a block to a chosen path and branch.
 *
 * Effects are one slot; an Amp+Cab is two, so it gets its own mode with a
 * separate cab picker (and a "no cab" option, which is a plain Amp block).
 * The button disables itself with the reason whenever a limit from the HX
 * Edit Pilot's Guide would be exceeded.
 */
export function AddBlockBar({
  catalog,
  models,
  amps,
  cabs,
  paths,
  checkEffect,
  checkAmp,
  onAddEffect,
  onAddAmp,
}: {
  catalog: Catalog | null;
  models: SwapCandidate[];
  amps: SwapCandidate[];
  cabs: SwapCandidate[];
  paths: string[];
  checkEffect: (modelId: string, dspKey: string, path: number) => Verdict;
  checkAmp: (modelId: string, dspKey: string, path: number) => Verdict;
  onAddEffect: (modelId: string, dspKey: string, path: number) => void;
  onAddAmp: (ampId: string, cabId: string | null, dspKey: string, path: number) => void;
}) {
  const [kind, setKind] = useState<"effect" | "amp">("effect");
  const [effectId, setEffectId] = useState("");
  const [ampId, setAmpId] = useState("");
  const [cabId, setCabId] = useState("");
  const [dspKey, setDspKey] = useState(paths[0] ?? "dsp0");
  const [branch, setBranch] = useState(0);

  const effectGroups = useMemo(() => groupByCategory(models, catalog), [models, catalog]);
  const ampGroups = useMemo(() => groupBySubcategory(amps), [amps]);
  const cabGroups = useMemo(() => groupBySubcategory(cabs), [cabs]);

  if (!catalog || models.length === 0) return null;

  const isAmp = kind === "amp";
  const selectedEffect = effectId || effectGroups[0]?.[1]?.[0]?.id || "";
  const selectedAmp = ampId || ampGroups[0]?.[1]?.[0]?.id || "";
  const verdict: Verdict = isAmp
    ? selectedAmp
      ? checkAmp(selectedAmp, dspKey, branch)
      : { allowed: false }
    : selectedEffect
      ? checkEffect(selectedEffect, dspKey, branch)
      : { allowed: false };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="flex overflow-hidden rounded border border-neutral-800 text-xs">
        {(["effect", "amp"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`px-2 py-1 transition-colors ${
              kind === k ? "bg-neutral-700 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {k === "effect" ? "Effect" : "Amp+Cab"}
          </button>
        ))}
      </div>

      {isAmp ? (
        <>
          <select
            value={selectedAmp}
            onChange={(e) => setAmpId(e.target.value)}
            aria-label="Amp model"
            className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
          >
            {renderGroups(ampGroups)}
          </select>
          <select
            value={cabId}
            onChange={(e) => setCabId(e.target.value)}
            aria-label="Cab model"
            className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
          >
            <option value="">(no cab — Amp only)</option>
            {renderGroups(cabGroups)}
          </select>
        </>
      ) : (
        <select
          value={selectedEffect}
          onChange={(e) => setEffectId(e.target.value)}
          aria-label="Effect model"
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
        >
          {renderGroups(effectGroups)}
        </select>
      )}

      <select
        value={dspKey}
        onChange={(e) => setDspKey(e.target.value)}
        aria-label="Path"
        className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
      >
        {paths.map((key) => (
          <option key={key} value={key}>
            Path {Number(key.slice(3)) + 1}
          </option>
        ))}
      </select>

      <select
        value={branch}
        onChange={(e) => setBranch(Number(e.target.value))}
        aria-label="Branch"
        className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
      >
        <option value={0}>A</option>
        <option value={1}>B</option>
      </select>

      <button
        type="button"
        disabled={!verdict.allowed}
        title={verdict.reason}
        onClick={() =>
          isAmp
            ? onAddAmp(selectedAmp, cabId || null, dspKey, branch)
            : onAddEffect(selectedEffect, dspKey, branch)
        }
        className="rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white enabled:hover:bg-sky-500 disabled:opacity-40"
      >
        Add
      </button>

      {!verdict.allowed && verdict.reason && (
        <span className="text-[11px] text-amber-500">{verdict.reason}</span>
      )}
    </div>
  );
}

type Group = [string, SwapCandidate[]];

function renderGroups(groups: Group[]) {
  return groups.map(([label, items]) =>
    label ? (
      <optgroup key={label} label={label}>
        {items.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </optgroup>
    ) : (
      items.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))
    )
  );
}

function groupBySubcategory(models: SwapCandidate[]): Group[] {
  const groups = new Map<string, SwapCandidate[]>();
  for (const m of models) {
    const key = m.subcategory ?? "";
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }
  return [...groups.entries()];
}

function groupByCategory(models: SwapCandidate[], catalog: Catalog | null): Group[] {
  const groups = new Map<string, SwapCandidate[]>();
  for (const m of models) {
    const id = catalog?.models[m.id]?.category;
    const key = id != null ? (catalog?.categories[String(id)]?.name ?? "Other") : "Other";
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
