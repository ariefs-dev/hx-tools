"""Render a parsed preset as a human-readable signal-chain summary."""

from __future__ import annotations

from typing import Any

from . import model

__all__ = ["explain"]


def explain(data: dict[str, Any]) -> str:
    lines = [f"# {model.preset_name(data)}"]

    for dsp_key, dsp in model.dsp_paths(data).items():
        path_num = int(dsp_key[len("dsp") :]) + 1
        lines.append(f"\n## Path {path_num} ({dsp_key})")
        blocks = model.ordered_blocks(dsp)
        if not blocks:
            lines.append("  (empty)")
        for slot_key, block in blocks:
            model_id = block.get("@model", "?")
            enabled = block.get("@enabled", True)
            state = "on" if enabled else "off"
            lines.append(f"  [{slot_key}] {model_id} - {state}")

    snaps = model.snapshots(data)
    if snaps:
        lines.append("\nSnapshots:")
        for key, snap in snaps:
            lines.append(f"  {key}: {snap.get('@name')}")

    return "\n".join(lines)
