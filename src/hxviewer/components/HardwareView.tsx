"use client";

import { useState } from "react";
import type { Catalog } from "@/lib/hlx/catalog";
import { describeBlock, type BlockDisplay } from "@/lib/hlx/display";
import { buildGrid, footswitches, type GridEntry, type PathGrid } from "@/lib/hlx/grid";
import { dspPaths, presetName, type HlxPreset } from "@/lib/hlx/model";
import { summarizeSnapshots } from "@/lib/hlx/snapshots";
import { FootswitchPanel, type PanelMode } from "./FootswitchPanel";
import { PerformanceView } from "./PerformanceView";

/**
 * A rendering of the Helix Home screen, following the layout described in the
 * Owner's Manual: the signal flow with an upper row A and lower row B per
 * path, input and output blocks pinned to the ends, the selected block
 * outlined, bypassed blocks dimmed, and the selected block's parameters laid
 * across the six knobs beneath — six per page, with a page indicator when a
 * block has more.
 */
export function HardwareView({
  preset,
  catalog,
  selectedPath,
  selectedSlot,
  onSelect,
  onSelectSnapshot,
  page,
  onPageChange,
}: {
  preset: HlxPreset;
  catalog: Catalog | null;
  selectedPath: string | null;
  selectedSlot: string | null;
  onSelect: (dspKey: string, slot: string) => void;
  onSelectSnapshot: (index: number) => void;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const [mode, setMode] = useState<PanelMode>("stomp");
  // The LT's VIEW button toggles the two main Home views.
  const [lcdView, setLcdView] = useState<"flow" | "performance">("flow");
  // Deliberately not memoized on `preset`: edits mutate the preset tree in
  // place, so its object identity never changes and a `[preset]` dependency
  // would serve stale layout and snapshot state after every edit. These are
  // cheap — two paths and eight snapshots — and the parent only re-renders
  // when something actually changed.
  const grids = Object.entries(dspPaths(preset)).map(([key, dsp]) => buildGrid(key, dsp));
  const snaps = summarizeSnapshots(preset);
  const switches = footswitches(preset);
  const activeSnapshot = snaps.find((s) => s.active);

  const selected =
    selectedPath && selectedSlot
      ? ((preset.data?.tone?.[selectedPath] as Record<string, unknown> | undefined)?.[
          selectedSlot
        ] as Parameters<typeof describeBlock>[0] | undefined)
      : undefined;
  const info = selected ? describeBlock(selected, catalog) : null;

  const PER_PAGE = 6;
  const pageCount = info ? Math.max(1, Math.ceil(info.params.length / PER_PAGE)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const pageParams = info ? info.params.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE) : [];

  return (
    <div className="rounded-xl border border-neutral-700 bg-gradient-to-b from-neutral-800 to-neutral-900 p-4 shadow-2xl">
      {/* ---- LCD ---- */}
      <div className="rounded-lg bg-black p-4 ring-1 ring-neutral-700">
        <div className="mb-3 flex items-baseline justify-between border-b border-neutral-800 pb-2">
          <span className="truncate text-sm font-semibold tracking-wide text-neutral-100">
            {presetName(preset)}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            {activeSnapshot && (
              <span className="text-[11px] uppercase tracking-widest text-sky-400">
                {activeSnapshot.name}
              </span>
            )}
            <button
              type="button"
              onClick={() => setLcdView(lcdView === "flow" ? "performance" : "flow")}
              title="Toggle between the Signal Flow and Performance home views"
              className="rounded border border-neutral-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-neutral-400 hover:text-neutral-100"
            >
              View
            </button>
          </div>
        </div>

        {lcdView === "flow" ? (
          <div className="space-y-4 overflow-x-auto">
            {grids.map((grid, i) => (
              <PathRows
                key={grid.dspKey}
                grid={grid}
                label={`Path ${i + 1}`}
                catalog={catalog}
                selectedPath={selectedPath}
                selectedSlot={selectedSlot}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <PerformanceView
            preset={preset}
            catalog={catalog}
            switches={switches}
            snapshots={snaps}
            mode={mode}
            selectedPath={selectedPath}
            selectedSlot={selectedSlot}
            onSelectBlock={onSelect}
            onSelectSnapshot={onSelectSnapshot}
          />
        )}

        {/* ---- selected block + its six knobs ---- */}
        <div className="mt-4 border-t border-neutral-800 pt-3">
          {info ? (
            <>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="truncate text-xs font-semibold text-neutral-100">
                  <span style={{ color: info.categoryColor ?? "#a3a3a3" }}>
                    {info.categoryLabel}
                  </span>{" "}
                  {info.name}
                </span>
                {pageCount > 1 && (
                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-neutral-500">
                    <button
                      type="button"
                      onClick={() => onPageChange(Math.max(0, safePage - 1))}
                      disabled={safePage === 0}
                      className="px-1 disabled:opacity-30"
                      aria-label="Previous parameter page"
                    >
                      &lsaquo;
                    </button>
                    {safePage + 1}/{pageCount}
                    <button
                      type="button"
                      onClick={() => onPageChange(Math.min(pageCount - 1, safePage + 1))}
                      disabled={safePage >= pageCount - 1}
                      className="px-1 disabled:opacity-30"
                      aria-label="Next parameter page"
                    >
                      &rsaquo;
                    </button>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: PER_PAGE }).map((_, i) => {
                  const p = pageParams[i];
                  return (
                    <div key={i} className="min-w-0 text-center">
                      <div className="truncate font-mono text-xs text-neutral-100">
                        {p ? p.display : ""}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-neutral-500">
                        {p ? p.label : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-center text-xs text-neutral-600">
              Select a block to see its parameters
            </p>
          )}
        </div>
      </div>

      {/* ---- knobs 1-6, sitting under their parameter cells ---- */}
      <div className="mt-3 grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const p = pageParams[i];
          // Point the indicator at the value's position in its range, so the
          // knobs read at a glance the way the real ones do.
          const angle =
            p && typeof p.raw === "number" && p.min !== null && p.max !== null && p.max > p.min
              ? -135 + ((p.raw - p.min) / (p.max - p.min)) * 270
              : -135;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`relative h-9 w-9 rounded-full border shadow-inner ${
                  p ? "border-neutral-600 bg-gradient-to-b from-neutral-600 to-neutral-800" : "border-neutral-800 bg-neutral-900"
                }`}
              >
                <div
                  className="absolute left-1/2 top-1/2 h-4 w-0.5 origin-bottom rounded"
                  style={{
                    backgroundColor: p ? "#e5e5e5" : "#404040",
                    transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                    transformOrigin: "50% 100%",
                  }}
                />
              </div>
              <span className="text-[9px] text-neutral-600">{i + 1}</span>
            </div>
          );
        })}
      </div>

      {/* ---- footswitch panel ---- */}
      <div className="mt-4">
        <FootswitchPanel
          preset={preset}
          catalog={catalog}
          switches={switches}
          snapshots={snaps}
          mode={mode}
          onModeChange={setMode}
          onSelectBlock={onSelect}
          onSelectSnapshot={onSelectSnapshot}
          selectedPath={selectedPath}
          selectedSlot={selectedSlot}
        />
      </div>
    </div>
  );
}

function PathRows({
  grid,
  label,
  catalog,
  selectedPath,
  selectedSlot,
  onSelect,
}: {
  grid: PathGrid;
  label: string;
  catalog: Catalog | null;
  selectedPath: string | null;
  selectedSlot: string | null;
  onSelect: (dspKey: string, slot: string) => void;
}) {
  const isSelected = (slot: string) => selectedPath === grid.dspKey && selectedSlot === slot;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
          {label}
        </span>
        {grid.parallel && (
          <span className="text-[9px] uppercase tracking-wide text-neutral-700">parallel</span>
        )}
      </div>
      <div className="flex items-stretch gap-1">
        <div className="flex flex-col justify-center gap-1">
          {grid.inputs.map((entry) => (
            <Slot
              key={entry.slot}
              entry={entry}
              catalog={catalog}
              selected={isSelected(entry.slot)}
              onSelect={() => onSelect(grid.dspKey, entry.slot)}
              terminal
            />
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <Row
            cells={grid.rowA}
            rowLabel="A"
            grid={grid}
            catalog={catalog}
            isSelected={isSelected}
            onSelect={onSelect}
          />
          {grid.parallel && (
            <Row
              cells={grid.rowB}
              rowLabel="B"
              grid={grid}
              catalog={catalog}
              isSelected={isSelected}
              onSelect={onSelect}
            />
          )}
        </div>

        <div className="flex flex-col justify-center gap-1">
          {grid.outputs.map((entry) => (
            <Slot
              key={entry.slot}
              entry={entry}
              catalog={catalog}
              selected={isSelected(entry.slot)}
              onSelect={() => onSelect(grid.dspKey, entry.slot)}
              terminal
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({
  cells,
  rowLabel,
  grid,
  catalog,
  isSelected,
  onSelect,
}: {
  cells: (GridEntry | null)[];
  rowLabel: string;
  grid: PathGrid;
  catalog: Catalog | null;
  isSelected: (slot: string) => boolean;
  onSelect: (dspKey: string, slot: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-3 shrink-0 text-center text-[9px] text-neutral-700">{rowLabel}</span>
      {cells.map((entry, column) => (
        <div key={column} className="flex items-center">
          {column === grid.splitColumn && <Spine kind="split" />}
          {entry ? (
            <Slot
              entry={entry}
              catalog={catalog}
              selected={isSelected(entry.slot)}
              onSelect={() => onSelect(grid.dspKey, entry.slot)}
            />
          ) : (
            <div className="h-10 w-[76px] rounded border border-dashed border-neutral-900" />
          )}
          {column === grid.joinColumn && <Spine kind="join" />}
        </div>
      ))}
    </div>
  );
}

function Spine({ kind }: { kind: "split" | "join" }) {
  return (
    <span
      className="mx-0.5 select-none text-[10px] text-neutral-600"
      title={kind === "split" ? "Split" : "Merge"}
    >
      {kind === "split" ? "<" : ">"}
    </span>
  );
}

function Slot({
  entry,
  catalog,
  selected,
  onSelect,
  terminal = false,
}: {
  entry: GridEntry;
  catalog: Catalog | null;
  selected: boolean;
  onSelect: () => void;
  terminal?: boolean;
}) {
  const info: BlockDisplay = describeBlock(entry.block, catalog);
  const cab = (entry as GridEntry & { cab?: GridEntry }).cab;
  const cabInfo = cab ? describeBlock(cab.block, catalog) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${info.name}${cabInfo ? ` + ${cabInfo.name}` : ""} (${entry.slot})`}
      className={`h-10 ${terminal ? "w-14" : "w-[76px]"} overflow-hidden rounded border px-1 text-left transition-colors ${
        selected ? "border-white bg-neutral-800" : "border-neutral-800 bg-neutral-900/80 hover:border-neutral-600"
      } ${info.enabled ? "" : "opacity-40"}`}
      style={
        info.categoryColor && !terminal
          ? { borderLeftColor: info.categoryColor, borderLeftWidth: 3 }
          : undefined
      }
    >
      <span className="block truncate text-[9px] leading-tight" style={{ color: info.categoryColor ?? "#8a8a8a" }}>
        {terminal ? info.categoryLabel : info.categoryLabel}
      </span>
      <span className="block truncate text-[10px] leading-tight text-neutral-100">{info.name}</span>
      {cabInfo && (
        <span className="block truncate text-[9px] leading-tight text-neutral-500">
          + {cabInfo.name}
        </span>
      )}
    </button>
  );
}
