"""Generic structural diff for comparing two snapshots (or two whole presets)."""

from __future__ import annotations

from typing import Any

from . import model

__all__ = ["diff_values", "diff_snapshots"]

_MISSING = object()


def diff_values(a: Any, b: Any, path: str = "") -> list[tuple[str, Any, Any]]:
    """Return (path, value_in_a, value_in_b) for every leaf that differs."""
    diffs: list[tuple[str, Any, Any]] = []
    if isinstance(a, dict) and isinstance(b, dict):
        for key in sorted(set(a) | set(b)):
            child_path = f"{path}.{key}" if path else key
            diffs.extend(diff_values(a.get(key, _MISSING), b.get(key, _MISSING), child_path))
    elif isinstance(a, list) and isinstance(b, list):
        for i in range(max(len(a), len(b))):
            child_path = f"{path}[{i}]"
            av = a[i] if i < len(a) else _MISSING
            bv = b[i] if i < len(b) else _MISSING
            diffs.extend(diff_values(av, bv, child_path))
    elif a != b:
        diffs.append((path, a, b))
    return diffs


def diff_snapshots(data: dict[str, Any], key_a: str, key_b: str) -> list[tuple[str, Any, Any]]:
    """Diff two snapshots within one preset by their keys (e.g. "snapshot0", "snapshot1")."""
    snaps = dict(model.snapshots(data))
    if key_a not in snaps:
        raise KeyError(f"No such snapshot: {key_a}")
    if key_b not in snaps:
        raise KeyError(f"No such snapshot: {key_b}")
    return diff_values(snaps[key_a], snaps[key_b])
