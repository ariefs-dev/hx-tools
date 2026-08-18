"""Structural helpers for walking a parsed ``.hlx`` preset.

A preset's signal-chain data lives at ``data["data"]["tone"]``, alongside up
to 8 snapshots. Each DSP path (``dsp0``, ``dsp1``, ...) holds a flat dict of
named slots; a slot belongs to the signal chain if it has an ``@model`` key.
Ordering isn't uniform across slot kinds, based on real presets inspected
while building this:

- ``inputA``/``inputB`` have no ``@position`` — they're fixed chain starts,
  ordered by their ``@input`` field instead.
- ``outputA``/``outputB`` likewise have no ``@position`` — fixed chain ends,
  ordered by ``@output``.
- ``cabN`` slots have no ``@position`` either. A cab isn't independently
  placed in the chain — it's driven by the amp/preamp block that references
  it via that block's own ``@cab`` field, so it's rendered immediately after
  that block rather than sorted on its own.
- Everything else (``blockN``, ``split``, ``join``, ...) does carry
  ``@position`` and is sorted by it.

This module doesn't know what any ``@model`` string *means* (that needs a
model catalog, deliberately not included here — see the project README), and
it doesn't attempt to represent parallel-path branching from split/join as a
graph — just a flat, best-effort chain order.
"""

from __future__ import annotations

from typing import Any

__all__ = ["preset_name", "dsp_paths", "ordered_blocks", "snapshots", "to_dict"]


def preset_name(data: dict[str, Any]) -> str:
    return data.get("data", {}).get("meta", {}).get("name", "(unnamed)")


def dsp_paths(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Return the {"dsp0": {...}, "dsp1": {...}} signal-chain containers, in order."""
    tone = data.get("data", {}).get("tone", {})
    paths = {k: v for k, v in tone.items() if k.startswith("dsp") and isinstance(v, dict)}
    return dict(sorted(paths.items()))


def ordered_blocks(dsp: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """Return (slot_key, block) pairs for one DSP path, in signal-chain order."""
    inputs: list[tuple[float, str, dict[str, Any]]] = []
    outputs: list[tuple[float, str, dict[str, Any]]] = []
    chain: list[tuple[float, str, dict[str, Any]]] = []
    cabs: dict[str, tuple[str, dict[str, Any]]] = {}

    for key, val in dsp.items():
        if not isinstance(val, dict) or "@model" not in val:
            continue
        if key.startswith("input"):
            inputs.append((val.get("@input", 0), key, val))
        elif key.startswith("output"):
            outputs.append((val.get("@output", 0), key, val))
        elif key.startswith("cab"):
            cabs[key] = (key, val)
        else:
            chain.append((val.get("@position", float("inf")), key, val))

    inputs.sort(key=lambda e: e[0])
    outputs.sort(key=lambda e: e[0])
    chain.sort(key=lambda e: e[0])

    result = [(key, val) for _, key, val in inputs]
    for _, key, val in chain:
        result.append((key, val))
        cab_key = val.get("@cab")
        if cab_key and cab_key in cabs:
            result.append(cabs.pop(cab_key))
    result.extend(cabs.values())  # any cab not referenced by a block we saw
    result.extend((key, val) for _, key, val in outputs)
    return result


def snapshots(data: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """Return (snapshot_key, snapshot) pairs, ordered snapshot0..snapshot7."""
    tone = data.get("data", {}).get("tone", {})
    entries = [
        (key, val)
        for key, val in tone.items()
        if key.startswith("snapshot") and isinstance(val, dict) and "@name" in val
    ]
    entries.sort(key=lambda kv: int(kv[0][len("snapshot") :]))
    return entries


def to_dict(data: dict[str, Any]) -> dict[str, Any]:
    """A JSON-serializable structural summary, for programmatic consumers (e.g. the MCP server)."""
    return {
        "name": preset_name(data),
        "paths": {
            dsp_key: [
                {
                    "slot": slot_key,
                    "model": block.get("@model"),
                    "enabled": block.get("@enabled", True),
                }
                for slot_key, block in ordered_blocks(dsp)
            ]
            for dsp_key, dsp in dsp_paths(data).items()
        },
        "snapshots": [{"key": key, "name": snap.get("@name")} for key, snap in snapshots(data)],
    }
