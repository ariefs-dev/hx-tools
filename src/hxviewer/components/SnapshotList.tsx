"use client";

import type { SnapshotSummary } from "@/lib/hlx/snapshots";

/**
 * The eight snapshots. Clicking one makes it active, which recalls its stored
 * bypass states and controller values onto the blocks — the same thing the
 * footswitches do on the hardware. The active snapshot's name is editable in
 * place.
 */
export function SnapshotList({
  snapshots,
  onSelect,
  onRename,
  readOnly = false,
}: {
  snapshots: SnapshotSummary[];
  onSelect: (index: number) => void;
  onRename: (key: string, name: string) => void;
  readOnly?: boolean;
}) {
  if (snapshots.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Snapshots
      </h3>
      <div className="flex flex-wrap gap-2">
        {snapshots.map((snap) =>
          snap.active ? (
            <div
              key={snap.key}
              className="flex items-center gap-1 rounded-full border border-sky-500 bg-sky-950/40 px-3 py-1"
              title={`Active — ${snap.blocksOn} of ${snap.blocksTracked} blocks on`}
            >
              <input
                value={snap.name}
                onChange={(e) => onRename(snap.key, e.target.value)}
                aria-label={`Name of ${snap.key}`}
                readOnly={readOnly}
                className="w-24 bg-transparent text-center text-xs text-neutral-100 focus:outline-none"
              />
              <span className="text-[10px] text-sky-400">
                {snap.blocksOn}/{snap.blocksTracked}
              </span>
            </div>
          ) : (
            <button
              key={snap.key}
              type="button"
              onClick={() => onSelect(snap.index)}
              disabled={readOnly}
              title={
                readOnly
                  ? "Switch to Editor to recall a snapshot"
                  : `Recall this snapshot — ${snap.blocksOn} of ${snap.blocksTracked} blocks on`
              }
              className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 enabled:hover:border-neutral-600 disabled:opacity-60"
            >
              <span className="w-24 truncate">{snap.name}</span>
              <span className="text-[10px] text-neutral-600">
                {snap.blocksOn}/{snap.blocksTracked}
              </span>
            </button>
          )
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-neutral-600">
        {readOnly
          ? "Read only — switch to Editor to recall or rename snapshots."
          : "Click a snapshot to recall it. Edits apply to the active snapshot."}
      </p>
    </div>
  );
}
