"""Editing an existing block's parameter value.

Deliberately scoped to *changing values already present in the file* — it
does not add/remove/reorder blocks or know default values for a fresh block,
which would require a model catalog (see the project README for why that's
left out of v0.1).
"""

from __future__ import annotations

from typing import Any

__all__ = ["get_param", "set_param"]


def _get_block(data: dict[str, Any], dsp_key: str, slot_key: str) -> dict[str, Any]:
    tone = data.get("data", {}).get("tone", {})
    dsp = tone.get(dsp_key)
    if dsp is None:
        raise KeyError(f"No such DSP path: {dsp_key}")
    block = dsp.get(slot_key)
    if block is None:
        raise KeyError(f"No such block: {dsp_key}.{slot_key}")
    return block


def get_param(data: dict[str, Any], dsp_key: str, slot_key: str, param: str) -> Any:
    """Read ``param``'s current value from the block at ``data.data.tone[dsp_key][slot_key]``."""
    block = _get_block(data, dsp_key, slot_key)
    if param not in block:
        raise KeyError(f"No such parameter '{param}' on {dsp_key}.{slot_key}")
    return block[param]


def set_param(data: dict[str, Any], dsp_key: str, slot_key: str, param: str, value: Any) -> None:
    """Set ``param`` on the block at ``data.data.tone[dsp_key][slot_key]`` in place."""
    block = _get_block(data, dsp_key, slot_key)
    if param not in block:
        raise KeyError(f"No such parameter '{param}' on {dsp_key}.{slot_key}")

    existing = block[param]
    if isinstance(existing, bool):
        if not isinstance(value, bool):
            raise TypeError(f"Parameter '{param}' is boolean, got {type(value).__name__}")
    elif isinstance(existing, float):
        value = float(value)
    elif isinstance(existing, int):
        if isinstance(value, float) and not value.is_integer():
            raise TypeError(f"Parameter '{param}' is an integer field, got non-integer float {value}")
        value = int(value)

    block[param] = value
