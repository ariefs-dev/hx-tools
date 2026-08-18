"use client";

import type { Catalog } from "@/lib/hlx/catalog";
import { describeBlock } from "@/lib/hlx/display";
import type { FootswitchEntry } from "@/lib/hlx/grid";
import type { HlxPreset } from "@/lib/hlx/model";
import type { SnapshotSummary } from "@/lib/hlx/snapshots";

/**
 * The twelve footswitches, in the arrangement the Cheat Sheet documents:
 *
 *   FS1  FS2  FS3  FS4  FS5  FS6
 *   FS7  FS8  FS9  FS10 FS11 FS12
 *
 * with fixed roles at the ends — FS1/FS7 are BANK up/down, FS6 toggles
 * Preset/Stomp mode, FS12 is TAP (hold for tuner) — leaving "the middle eight
 * footswitches" (FS2-5, FS8-11) for blocks, which is what the Owner's Manual
 * calls them.
 *
 * In Snapshot footswitch mode those same middle eight become snapshots 1-8.
 *
 * Which block lands on which switch is *not* claimed: `@fs_index` runs 2..18
 * in real presets, so it cannot be a switch number, and the mapping isn't
 * publicly documented. Assignments fill the eight stomp positions in
 * `@fs_index` order.
 */

export type PanelMode = "stomp" | "snapshot";

const STOMP_POSITIONS = [1, 2, 3, 4, 7, 8, 9, 10]; // zero-based FS2-5, FS8-11

export function FootswitchPanel({
  preset,
  catalog,
  switches,
  snapshots,
  mode,
  onModeChange,
  onSelectBlock,
  onSelectSnapshot,
  selectedPath,
  selectedSlot,
}: {
  preset: HlxPreset;
  catalog: Catalog | null;
  switches: FootswitchEntry[];
  snapshots: SnapshotSummary[];
  mode: PanelMode;
  onModeChange: (mode: PanelMode) => void;
  onSelectBlock: (dspKey: string, slot: string) => void;
  onSelectSnapshot: (index: number) => void;
  selectedPath: string | null;
  selectedSlot: string | null;
}) {
  const cells = Array.from({ length: 12 }, (_, i) => i);

  function stompSlotAt(fsIndex: number): FootswitchEntry | null {
    const order = STOMP_POSITIONS.indexOf(fsIndex);
    return order >= 0 ? (switches[order] ?? null) : null;
  }

  return (
    <div className="rounded-lg bg-neutral-900 p-3 ring-1 ring-neutral-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-neutral-600">
          Footswitches
        </span>
        <div className="flex overflow-hidden rounded border border-neutral-800 text-[10px]">
          {(["stomp", "snapshot"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-2 py-0.5 capitalize transition-colors ${
                mode === m ? "bg-neutral-700 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {cells.map((i) => {
          const fsNumber = i + 1;

          // Fixed-role switches at the row ends.
          if (i === 0) return <FixedSwitch key={i} fs={fsNumber} top="BANK" bottom="▲" />;
          if (i === 6) return <FixedSwitch key={i} fs={fsNumber} top="BANK" bottom="▼" />;
          if (i === 5) {
            return (
              <FixedSwitch
                key={i}
                fs={fsNumber}
                top={mode === "stomp" ? "STOMP" : "SNAPSHOT"}
                bottom="MODE"
                onClick={() => onModeChange(mode === "stomp" ? "snapshot" : "stomp")}
                accent
              />
            );
          }
          if (i === 11) return <FixedSwitch key={i} fs={fsNumber} top="TAP" bottom="TUNER" />;

          if (mode === "snapshot") {
            const order = STOMP_POSITIONS.indexOf(i);
            const snap = snapshots[order];
            if (!snap) return <EmptySwitch key={i} fs={fsNumber} />;
            return (
              <SwitchCell
                key={i}
                fs={fsNumber}
                label={snap.name}
                sub={`${snap.blocksOn}/${snap.blocksTracked}`}
                color="#dd1111"
                lit={snap.active}
                highlighted={snap.active}
                onClick={() => onSelectSnapshot(snap.index)}
              />
            );
          }

          const entry = stompSlotAt(i);
          if (!entry) return <EmptySwitch key={i} fs={fsNumber} />;
          const block = (preset.data?.tone?.[entry.dspKey] as Record<string, unknown> | undefined)?.[
            entry.slot
          ] as Parameters<typeof describeBlock>[0] | undefined;
          const info = block ? describeBlock(block, catalog) : null;
          return (
            <SwitchCell
              key={i}
              fs={fsNumber}
              label={entry.label}
              sub={entry.momentary ? "momentary" : undefined}
              color={info?.categoryColor ?? "#737373"}
              lit={info?.enabled ?? false}
              highlighted={selectedPath === entry.dspKey && selectedSlot === entry.slot}
              onClick={() => onSelectBlock(entry.dspKey, entry.slot)}
            />
          );
        })}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-neutral-600">
        FS1/FS7 bank, FS6 switches mode, FS12 is tap/tuner — the middle eight carry blocks, per the
        LT cheat sheet. Ring colour follows the block category (Helix&apos;s own default). The LT
        has no per-switch scribble strips; its labels live on the main display, so press{" "}
        <span className="text-neutral-400">View</span> for the Performance layout. Assignments fill
        the eight stomp positions in <code>@fs_index</code> order; that field ranges 2&ndash;18 in
        real presets, so it is not a physical switch number.
      </p>
    </div>
  );
}

function Chassis({
  fs,
  children,
  onClick,
  highlighted,
  title,
}: {
  fs: number;
  children: React.ReactNode;
  onClick?: () => void;
  highlighted?: boolean;
  title?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      title={title}
      className={`flex flex-col items-center gap-1 rounded border px-1 py-1.5 text-center transition-colors ${
        highlighted ? "border-white bg-neutral-800" : "border-neutral-800 bg-neutral-950"
      } ${onClick ? "hover:border-neutral-600" : ""}`}
    >
      {children}
      <span className="text-[8px] text-neutral-700">FS{fs}</span>
    </Tag>
  );
}

/** A scribble strip: the small LCD above each switch, plus its LED ring. */
function SwitchCell({
  fs,
  label,
  sub,
  color,
  lit,
  highlighted,
  onClick,
}: {
  fs: number;
  label: string;
  sub?: string;
  color: string;
  lit: boolean;
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <Chassis fs={fs} onClick={onClick} highlighted={highlighted} title={label}>
      <span className="block w-full truncate rounded-sm bg-black px-1 py-1 text-[9px] leading-tight text-neutral-100">
        {label}
      </span>
      <span
        className="h-3.5 w-3.5 rounded-full border-2 transition-colors"
        style={{
          borderColor: color,
          backgroundColor: lit ? color : "transparent",
          boxShadow: lit ? `0 0 6px ${color}` : undefined,
        }}
      />
      {sub && <span className="text-[8px] text-neutral-600">{sub}</span>}
    </Chassis>
  );
}

function FixedSwitch({
  fs,
  top,
  bottom,
  onClick,
  accent,
}: {
  fs: number;
  top: string;
  bottom: string;
  onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <Chassis fs={fs} onClick={onClick}>
      <span
        className={`block w-full truncate rounded-sm px-1 py-1 text-[9px] font-semibold leading-tight ${
          accent ? "bg-black text-sky-400" : "bg-black text-neutral-400"
        }`}
      >
        {top}
      </span>
      <span className="text-[8px] uppercase tracking-wide text-neutral-600">{bottom}</span>
    </Chassis>
  );
}

function EmptySwitch({ fs }: { fs: number }) {
  return (
    <Chassis fs={fs}>
      <span className="block w-full rounded-sm bg-black px-1 py-1 text-[9px] leading-tight text-neutral-800">
        &mdash;
      </span>
      <span className="h-3.5 w-3.5 rounded-full border-2 border-neutral-800" />
    </Chassis>
  );
}
