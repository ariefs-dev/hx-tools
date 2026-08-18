"use client";

import { useMemo, useState } from "react";
import type { Catalog } from "@/lib/hlx/catalog";
import type { SwapCandidate } from "@/lib/hlx/restructure";

/**
 * Adds an effects block to a chosen path and branch.
 *
 * Amp/Preamp/Cab/IR are absent by design — see `restructure.ts`. The button
 * disables itself with the reason when a limit from the HX Edit Pilot's Guide
 * would be exceeded (one Looper per preset, no free slot, and so on).
 */
export function AddBlockBar({
  catalog,
  models,
  paths,
  check,
  onAdd,
}: {
  catalog: Catalog | null;
  models: SwapCandidate[];
  paths: string[];
  check: (modelId: string, dspKey: string, path: number) => { allowed: boolean; reason?: string };
  onAdd: (modelId: string, dspKey: string, path: number) => void;
}) {
  const [modelId, setModelId] = useState("");
  const [dspKey, setDspKey] = useState(paths[0] ?? "dsp0");
  const [branch, setBranch] = useState(0);

  const grouped = useMemo(() => {
    const groups = new Map<string, SwapCandidate[]>();
    for (const m of models) {
      const key = catalog?.models[m.id]?.category != null ? categoryName(catalog, m.id) : "Other";
      const list = groups.get(key);
      if (list) list.push(m);
      else groups.set(key, [m]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [models, catalog]);

  if (!catalog || models.length === 0) return null;

  const selected = modelId || grouped[0]?.[1]?.[0]?.id || "";
  const verdict = selected ? check(selected, dspKey, branch) : { allowed: false };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
      <span className="text-xs text-neutral-500">Add block</span>

      <select
        value={selected}
        onChange={(e) => setModelId(e.target.value)}
        className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
      >
        {grouped.map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

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
        onClick={() => onAdd(selected, dspKey, branch)}
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

function categoryName(catalog: Catalog, modelId: string): string {
  const id = catalog.models[modelId]?.category;
  return id != null ? (catalog.categories[String(id)]?.name ?? "Other") : "Other";
}
