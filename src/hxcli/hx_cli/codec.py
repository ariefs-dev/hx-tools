"""Byte-exact JSON codec for Line 6 Helix ``.hlx`` preset files.

Helix (HX Edit / hardware export) serializes presets as JSON, but with a
formatting style that differs from Python's default ``json`` module: a space
before each colon (``"key" : value``), floats printed at full double
precision (``%.17g``, a holdover from widening internal float32 parameter
values), and lowercase ``true``/``false``. Round-tripping a real preset
through ``json.dumps`` alone silently reformats it byte-for-byte, which makes
it useless as a "did we understand this file correctly" safety check.

This module reproduces Helix's exact byte layout so that loading a preset
and immediately re-serializing it (with no edits) is byte-identical to the
original file. See :mod:`hx_cli.io` for the load/save layer that uses this
guarantee as a safety gate before writing changes back to disk.
"""

from __future__ import annotations

import json
from typing import Any

__all__ = ["loads", "dumps"]


def loads(text: str) -> Any:
    """Parse Helix ``.hlx`` JSON text into Python objects (dict key order preserved)."""
    return json.loads(text)


def dumps(obj: Any) -> str:
    """Serialize to Helix's exact ``.hlx`` JSON layout (no trailing newline)."""
    return _encode(obj, 0)


def _encode_string(value: str) -> str:
    r"""A JSON string as Helix writes it.

    Helix escapes forward slashes (``"1\/4 DLY"``). JSON permits ``\/`` but
    doesn't require it, and ``json.dumps`` never emits it — so a preset holding
    a slash (a note division in a footswitch label, most often) would come back
    differing from the original. Every slash inside a string is escaped in the
    presets checked: 2 escaped, 0 bare.
    """
    return json.dumps(value).replace("/", r"\/")


def _encode(obj: Any, indent: int) -> str:
    if isinstance(obj, dict):
        return _encode_dict(obj, indent)
    if isinstance(obj, list):
        return _encode_list(obj, indent)
    if isinstance(obj, bool):
        # bool is a subclass of int, so this check must come before the int check
        return "true" if obj else "false"
    if isinstance(obj, float):
        return "%.17g" % obj
    if isinstance(obj, int):
        return str(obj)
    if obj is None:
        return "null"
    if isinstance(obj, str):
        return _encode_string(obj)
    raise TypeError(f"Unsupported type in .hlx data: {type(obj)!r}")


def _encode_dict(obj: dict, indent: int) -> str:
    if not obj:
        return "{}"
    pad = "  " * indent
    pad_in = "  " * (indent + 1)
    items = [f"{pad_in}{json.dumps(k)} : {_encode(v, indent + 1)}" for k, v in obj.items()]
    return "{\n" + ",\n".join(items) + "\n" + pad + "}"


def _encode_list(obj: list, indent: int) -> str:
    if not obj:
        return "[]"
    pad = "  " * indent
    pad_in = "  " * (indent + 1)
    items = [f"{pad_in}{_encode(v, indent + 1)}" for v in obj]
    return "[\n" + ",\n".join(items) + "\n" + pad + "]"
