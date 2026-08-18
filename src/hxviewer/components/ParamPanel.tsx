"use client";

import { useMemo, useState } from "react";
import { CategoryIcon } from "@/lib/hlx/icons";
import type { BlockDisplay } from "@/lib/hlx/display";
import type { HlxBlock } from "@/lib/hlx/model";
import type { SwapCandidate, MoveDirection } from "@/lib/hlx/restructure";
import { ParamControl } from "./ParamControl";

/** Values as the device shows them, with nothing to click. */
function ReadOnlyParams({ params }: { params: BlockDisplay["params"] }) {
  return (
    <div className="mb-3 grid gap-x-6 sm:grid-cols-2">
      {params.map((p) => (
        <div
          key={p.id}
          className="flex items-baseline justify-between gap-2 border-b border-neutral-800 py-1"
        >
          <span className="text-sm text-neutral-400">{p.label}</span>
          <span className="font-mono text-xs text-neutral-100">{p.display}</span>
        </div>
      ))}
    </div>
  );
}

function formatRaw(value: unknown): string {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ParamPanel({
  slot,
  block,
  info,
  candidates,
  canMoveEarlier,
  canMoveLater,
  onParamChange,
  onToggleEnabled,
  onMove,
  onSwapModel,
  onRemove,
  cabs,
  currentCab,
  onSetCab,
  linked,
  onLinkedParamChange,
  onLinkedSwapModel,
  onLinkedToggleEnabled,
  readOnly = false,
}: {
  slot: string;
  block: HlxBlock;
  info: BlockDisplay;
  candidates: SwapCandidate[];
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  onParamChange: (param: string, value: number | boolean) => void;
  onToggleEnabled: (enabled: boolean) => void;
  onMove: (direction: MoveDirection) => void;
  onSwapModel: (modelId: string) => void;
  onRemove: () => void;
  cabs?: SwapCandidate[];
  currentCab?: string | null;
  onSetCab?: (cabModelId: string | null) => void;
  /**
   * The block named by this one's `@cab`. Both an Amp+Cab and a Dual Cab are
   * one block on the hardware but two slots in the file, so the linked half's
   * controls belong in the same panel.
   */
  linked?: {
    slot: string;
    block: HlxBlock;
    info: BlockDisplay;
    candidates: SwapCandidate[];
  } | null;
  onLinkedParamChange?: (param: string, value: number | boolean) => void;
  onLinkedSwapModel?: (modelId: string) => void;
  onLinkedToggleEnabled?: (enabled: boolean) => void;
  /** Viewing only: show every value, offer no way to change one. */
  readOnly?: boolean;
}) {
  const [iconFailed, setIconFailed] = useState(false);
  const showImage = info.iconUrl && !iconFailed;
  // Input/output/split/join blocks have no bypass state on the hardware.
  const canBypass = !readOnly && "@enabled" in block;
  const currentModel = typeof block["@model"] === "string" ? block["@model"] : "";
  // Inputs, outputs, split and merge are part of the path itself, not blocks
  // you can take out; they have no @position.
  const canRemove =
    !readOnly && typeof block["@position"] === "number" && slot !== "split" && slot !== "join";
  const canMove = canMoveEarlier || canMoveLater;

  // Group the picker by the catalog's own subcategories (Mono / Stereo /
  // Legacy ...), the way HX Edit's model list is organised.
  const grouped = useMemo(() => {
    const groups = new Map<string, SwapCandidate[]>();
    for (const c of candidates) {
      const key = c.subcategory ?? "";
      const list = groups.get(key);
      if (list) list.push(c);
      else groups.set(key, [c]);
    }
    return [...groups.entries()];
  }, [candidates]);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center gap-3">
        {showImage ? (
          /* See BlockCard: local /public PNG at a fixed size. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.iconUrl!}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
            onError={() => setIconFailed(true)}
          />
        ) : (
          <CategoryIcon category={info.fallbackCategory} className="h-8 w-8 text-neutral-200" />
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-neutral-100">{info.name}</p>
          <p className="text-xs" style={{ color: info.categoryColor ?? "#737373" }}>
            {info.categoryLabel}
            <span className="text-neutral-600"> &middot; {slot}</span>
            {info.dspLoad != null && (
              <span className="text-neutral-600"> &middot; DSP {info.dspLoad.toFixed(1)}%</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canMove && (
            <div className="flex items-center overflow-hidden rounded-md border border-neutral-800">
              <button
                type="button"
                disabled={!canMoveEarlier}
                onClick={() => onMove("earlier")}
                title="Move earlier in the chain"
                aria-label="Move earlier in the chain"
                className="px-2 py-1.5 text-xs text-neutral-300 enabled:hover:bg-neutral-800 disabled:opacity-30"
              >
                &larr;
              </button>
              <button
                type="button"
                disabled={!canMoveLater}
                onClick={() => onMove("later")}
                title="Move later in the chain"
                aria-label="Move later in the chain"
                className="border-l border-neutral-800 px-2 py-1.5 text-xs text-neutral-300 enabled:hover:bg-neutral-800 disabled:opacity-30"
              >
                &rarr;
              </button>
            </div>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove this block from the preset"
              className="rounded-md border border-neutral-800 px-2 py-1.5 text-xs text-neutral-400 hover:border-red-800 hover:text-red-400"
            >
              Remove
            </button>
          )}
          {canBypass && (
            <button
              type="button"
              onClick={() => onToggleEnabled(!info.enabled)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                info.enabled
                  ? "bg-sky-600 text-white hover:bg-sky-500"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              {info.enabled ? "ON" : "BYPASSED"}
            </button>
          )}
        </div>
      </div>

      {candidates.length > 0 && (
        <label className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
          <span className="shrink-0">Model</span>
          <select
            value={currentModel}
            onChange={(e) => {
              if (e.target.value !== currentModel) onSwapModel(e.target.value);
            }}
            className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
          >
            {grouped.map(([group, items]) =>
              group ? (
                <optgroup key={group} label={group}>
                  {items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ) : (
                items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )
            )}
          </select>
          <span className="shrink-0 text-neutral-600">
            swapping resets parameters to the model&apos;s defaults
          </span>
        </label>
      )}

      {onSetCab && cabs && cabs.length > 0 && (
        <label className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
          <span className="shrink-0">Cab</span>
          <select
            value={currentCab ?? ""}
            onChange={(e) => onSetCab(e.target.value || null)}
            className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
          >
            <option value="">(no cab — Amp only)</option>
            {cabs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {info.params.length > 0 &&
        (readOnly ? (
          <ReadOnlyParams params={info.params} />
        ) : (
          <div className="mb-3 grid gap-x-6 sm:grid-cols-2">
            {info.params.map((p) => (
              <ParamControl key={p.id} param={p} onChange={(v) => onParamChange(p.id, v)} />
            ))}
          </div>
        ))}

      {linked && (
        <div className="mb-3 rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-neutral-100">
              <span style={{ color: linked.info.categoryColor ?? "#737373" }}>
                {linked.info.categoryLabel}
              </span>{" "}
              {linked.info.name}
              <span className="text-neutral-600"> &middot; {linked.slot}</span>
            </p>
            {!readOnly && "@enabled" in linked.block && onLinkedToggleEnabled && (
              <button
                type="button"
                onClick={() => onLinkedToggleEnabled(!linked.info.enabled)}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  linked.info.enabled
                    ? "bg-sky-600 text-white hover:bg-sky-500"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                }`}
              >
                {linked.info.enabled ? "ON" : "BYPASSED"}
              </button>
            )}
          </div>

          {!readOnly && linked.candidates.length > 0 && onLinkedSwapModel && (
            <label className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
              <span className="shrink-0">Model</span>
              <select
                value={(linked.block["@model"] as string) ?? ""}
                onChange={(e) => onLinkedSwapModel(e.target.value)}
                className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
              >
                {linked.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {readOnly ? (
            <ReadOnlyParams params={linked.info.params} />
          ) : (
            onLinkedParamChange && (
              <div className="grid gap-x-6 sm:grid-cols-2">
                {linked.info.params.map((p) => (
                  <ParamControl
                    key={p.id}
                    param={p}
                    onChange={(v) => onLinkedParamChange(p.id, v)}
                  />
                ))}
              </div>
            )
          )}
        </div>
      )}

      <details className="text-xs text-neutral-500">
        <summary className="cursor-pointer select-none">Metadata ({info.metaKeys.length})</summary>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {info.metaKeys.map((key) => (
            <div key={key} className="flex items-baseline justify-between gap-2">
              <span>{key}</span>
              <span className="font-mono text-neutral-400">{formatRaw(block[key])}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
