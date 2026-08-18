"use client";

import type { Catalog } from "@/lib/hlx/catalog";
import { describeBlock } from "@/lib/hlx/display";
import type { FootswitchEntry } from "@/lib/hlx/grid";
import type { HlxPreset } from "@/lib/hlx/model";
import type { SnapshotSummary } from "@/lib/hlx/snapshots";

/**
 * The Helix LT's Home > Performance view, which "displays the middle eight
 * footswitches' assignments, so you know exactly what you're stomping on in
 * the heat of battle" (LT Owner's Manual).
 *
 * This is the LT's answer to the Floor's per-switch scribble strips: the LT
 * has no strips, so the switch labels live on the main display instead, as a
 * 4-across, 2-down grid of boxes. Bypassed blocks appear dim and the selected
 * one is outlined in white, matching the callouts on that page.
 */
export function PerformanceView({
  preset,
  catalog,
  switches,
  snapshots,
  mode,
  selectedPath,
  selectedSlot,
  onSelectBlock,
  onSelectSnapshot,
}: {
  preset: HlxPreset;
  catalog: Catalog | null;
  switches: FootswitchEntry[];
  snapshots: SnapshotSummary[];
  mode: "stomp" | "snapshot";
  selectedPath: string | null;
  selectedSlot: string | null;
  onSelectBlock: (dspKey: string, slot: string) => void;
  onSelectSnapshot: (index: number) => void;
}) {
  const cells = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((i) => {
        if (mode === "snapshot") {
          const snap = snapshots[i];
          if (!snap) return <EmptyBox key={i} />;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectSnapshot(snap.index)}
              className={`rounded border px-2 py-3 text-left transition-colors ${
                snap.active
                  ? "border-white bg-neutral-800"
                  : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-600"
              }`}
            >
              <span className="block text-[9px] uppercase tracking-wide text-neutral-500">
                Snapshot {snap.index + 1}
              </span>
              <span className="block truncate text-xs text-neutral-100">{snap.name}</span>
              <span className="block text-[9px] text-neutral-600">
                {snap.blocksOn}/{snap.blocksTracked} on
              </span>
            </button>
          );
        }

        const entry = switches[i];
        if (!entry) return <EmptyBox key={i} />;
        const block = (preset.data?.tone?.[entry.dspKey] as Record<string, unknown> | undefined)?.[
          entry.slot
        ] as Parameters<typeof describeBlock>[0] | undefined;
        const info = block ? describeBlock(block, catalog) : null;
        const selected = selectedPath === entry.dspKey && selectedSlot === entry.slot;

        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelectBlock(entry.dspKey, entry.slot)}
            className={`rounded border px-2 py-3 text-left transition-colors ${
              selected ? "border-white bg-neutral-800" : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-600"
            } ${info?.enabled ? "" : "opacity-45"}`}
            style={
              info?.categoryColor ? { borderLeftColor: info.categoryColor, borderLeftWidth: 3 } : undefined
            }
          >
            <span
              className="block text-[9px] uppercase tracking-wide"
              style={{ color: info?.categoryColor ?? "#737373" }}
            >
              {info?.categoryLabel ?? "—"}
            </span>
            <span className="block truncate text-xs text-neutral-100">{entry.label}</span>
            <span className="block text-[9px] text-neutral-600">
              {info?.enabled ? "on" : "bypassed"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyBox() {
  return (
    <div className="rounded border border-dashed border-neutral-900 px-2 py-3">
      <span className="block text-[9px] text-neutral-800">—</span>
      <span className="block text-xs text-neutral-800">unassigned</span>
    </div>
  );
}
