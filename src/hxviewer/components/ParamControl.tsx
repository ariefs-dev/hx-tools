"use client";

import { useState } from "react";
import type { DisplayParam } from "@/lib/hlx/display";

/**
 * One editable parameter row.
 *
 * Numbers get a slider plus a text box in *display* units — the numbers HX
 * Edit puts on screen (Drive 7.7, Level -29.7) rather than the stored 0.77 /
 * -29.7 — so typing matches what you'd read off the hardware. Discrete
 * controls become a dropdown of their real choices, and booleans a toggle.
 */
export function ParamControl({
  param,
  onChange,
}: {
  param: DisplayParam;
  onChange: (value: number | boolean) => void;
}) {
  if (param.kind === "boolean") {
    return (
      <Row label={<Label param={param} />}>
        <button
          type="button"
          onClick={() => onChange(!param.raw)}
          className={`w-14 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            param.raw ? "bg-sky-600 text-white" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          {param.raw ? "On" : "Off"}
        </button>
      </Row>
    );
  }

  if (param.kind === "choice" && param.options) {
    return (
      <Row label={<Label param={param} />}>
        <select
          value={Math.round(param.raw as number)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-40 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-100"
        >
          {param.options.map((opt, i) => (
            <option key={opt + i} value={i}>
              {opt}
            </option>
          ))}
        </select>
      </Row>
    );
  }

  if (param.kind === "number") {
    return <NumberControl param={param} onChange={onChange} />;
  }

  return (
    <Row label={<Label param={param} />}>
      <span className="font-mono text-xs text-neutral-500">{param.display}</span>
    </Row>
  );
}

function NumberControl({
  param,
  onChange,
}: {
  param: DisplayParam;
  onChange: (value: number) => void;
}) {
  const raw = param.raw as number;
  const hasRange = param.min !== null && param.max !== null && param.max > param.min;

  // While the box has focus its text is held locally, so a partially-typed
  // value ("-", "1.") isn't coerced mid-keystroke. Otherwise the stored value
  // is shown directly — derived, not synced, so dragging the slider updates
  // the box without an effect.
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = raw * param.scale;
  const text = draft ?? formatEditable(displayValue);

  // The box always holds base units, but HX Edit re-expresses some values —
  // 8000 Hz as "8.0 kHz", a pan of 0 as "Center", a cut at minimum as "Off".
  // Show its reading underneath only when it genuinely says something the box
  // can't, i.e. a different unit or a non-numeric label — not merely a
  // difference in decimal places.
  const altReading = (() => {
    if (!param.display) return null;
    const match = param.display.match(/-?[\d.,]+\s*(.*)$/);
    if (!match) return param.display; // a pure label such as "Center" or "Off"
    return match[1].trim() === param.unit ? null : param.display;
  })();

  function commit(next: string) {
    setDraft(null);
    const parsed = Number(next);
    // An empty or unparseable entry just reverts to the stored value.
    if (next.trim() === "" || Number.isNaN(parsed)) return;
    let stored = parsed / param.scale;
    if (param.min !== null) stored = Math.max(param.min, stored);
    if (param.max !== null) stored = Math.min(param.max, stored);
    onChange(stored);
  }

  return (
    <div className="border-b border-neutral-800 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label param={param} />
        <div className="flex items-baseline gap-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(text)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(null);
                e.currentTarget.blur();
              }
            }}
            className="w-20 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-right font-mono text-xs text-neutral-100"
          />
          <span className="w-10 text-left font-mono text-[11px] text-neutral-500">
            {param.unit}
          </span>
        </div>
      </div>
      {altReading && (
        <p className="text-right font-mono text-[10px] text-neutral-600">{altReading}</p>
      )}
      {hasRange && (
        <input
          type="range"
          min={param.min!}
          max={param.max!}
          step={(param.max! - param.min!) / 1000}
          value={raw}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-1 h-1 w-full accent-sky-500"
        />
      )}
    </div>
  );
}

/** Trim float noise for the text box without hiding real precision. */
function formatEditable(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toFixed(3));
  return String(rounded);
}

/**
 * Marks a parameter that stores a separate value in each snapshot. Per the
 * Owner's Manual, snapshots capture "the values of any parameters assigned to
 * controllers" — so this covers any controller assignment (an expression
 * pedal, a footswitch, or the Snapshots controller itself), not only the
 * Snapshots controller.
 */
function Label({ param }: { param: DisplayParam }) {
  return (
    <span className="flex items-baseline gap-1.5 text-sm text-neutral-400">
      {param.label}
      {param.snapshotControlled && (
        <span
          title="Controller-assigned, so it stores a separate value in each snapshot — editing changes the active snapshot's value"
          className="rounded bg-neutral-800 px-1 text-[9px] font-semibold uppercase tracking-wide text-sky-400"
        >
          snap
        </span>
      )}
    </span>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-neutral-800 py-1.5">
      {typeof label === "string" ? <span className="text-sm text-neutral-400">{label}</span> : label}
      {children}
    </div>
  );
}
