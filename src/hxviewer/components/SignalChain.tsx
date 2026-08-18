"use client";

import { orderedBlocks, type HlxDsp } from "@/lib/hlx/model";
import { describeBlock } from "@/lib/hlx/display";
import type { Catalog } from "@/lib/hlx/catalog";
import { BlockCard } from "./BlockCard";

export function SignalChain({
  pathLabel,
  dsp,
  catalog,
  selectedSlot,
  onSelectSlot,
}: {
  pathLabel: string;
  dsp: HlxDsp;
  catalog: Catalog | null;
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
}) {
  const blocks = orderedBlocks(dsp);

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        {pathLabel}
      </h3>
      {blocks.length === 0 ? (
        <p className="text-sm text-neutral-600">(empty)</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {blocks.map(({ slot, block }, i) => (
            <div key={slot} className="flex items-center gap-3">
              <BlockCard
                slot={slot}
                info={describeBlock(block, catalog)}
                selected={selectedSlot === slot}
                onSelect={() => onSelectSlot(slot)}
              />
              {i < blocks.length - 1 && <span className="shrink-0 text-neutral-700">&rarr;</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
