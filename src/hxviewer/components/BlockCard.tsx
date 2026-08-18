"use client";

import { useState } from "react";
import { CategoryIcon } from "@/lib/hlx/icons";
import type { BlockDisplay } from "@/lib/hlx/display";

export function BlockCard({
  slot,
  info,
  selected,
  onSelect,
}: {
  slot: string;
  info: BlockDisplay;
  selected: boolean;
  onSelect: () => void;
}) {
  const [iconFailed, setIconFailed] = useState(false);
  const showImage = info.iconUrl && !iconFailed;

  return (
    <button
      type="button"
      onClick={onSelect}
      style={info.categoryColor ? { borderTopColor: info.categoryColor, borderTopWidth: 3 } : undefined}
      className={`flex w-32 shrink-0 flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center transition-colors ${
        selected
          ? "border-sky-500 bg-sky-950/40"
          : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
      } ${info.enabled ? "" : "opacity-45"}`}
    >
      {showImage ? (
        /* Local imported PNGs served straight from /public at a fixed small
           size — next/image's optimization pipeline buys nothing here. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={info.iconUrl!}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
          onError={() => setIconFailed(true)}
        />
      ) : (
        <CategoryIcon category={info.fallbackCategory} className="h-7 w-7 text-neutral-200" />
      )}
      <span
        className="text-[11px] uppercase tracking-wide"
        style={{ color: info.categoryColor ?? "#737373" }}
      >
        {info.categoryLabel}
      </span>
      <span className="line-clamp-2 text-xs font-medium text-neutral-100">{info.name}</span>
      <span className="text-[10px] text-neutral-600">{slot}</span>
      {!info.enabled && <span className="text-[10px] font-semibold text-amber-500">OFF</span>}
    </button>
  );
}
