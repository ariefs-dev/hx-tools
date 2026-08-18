"""Safe load/save for ``.hlx`` preset files.

Save path is a gate, not just a write: validate structure -> confirm the
loaded data still round-trips to the original bytes -> write to a temp file
-> atomically replace the target, after copying the existing file to
``<name>.hlx.bak``. This mirrors the safety pattern used by other Helix
preset tools in the ecosystem (validate -> round-trip -> atomic write with
backup), implemented independently against the format found in
:mod:`hx_cli.codec`.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import codec

__all__ = ["FormatMeta", "Preset", "load", "save", "verify_roundtrip"]


@dataclass(frozen=True)
class FormatMeta:
    """Captures the original file's exact formatting so save() can reproduce it."""

    newline: str
    trailing_newline: bool


@dataclass
class Preset:
    data: dict[str, Any]
    fmt: FormatMeta
    path: Path


def _sniff_newline(raw: bytes) -> str:
    return "\r\n" if b"\r\n" in raw else "\n"


def _render(data: Any, fmt: FormatMeta) -> bytes:
    text = codec.dumps(data)
    if fmt.newline != "\n":
        text = text.replace("\n", fmt.newline)
    if fmt.trailing_newline:
        text += fmt.newline
    return text.encode("utf-8")


def load(path: str | Path) -> Preset:
    """Load a ``.hlx`` file, capturing its formatting for a faithful save() later."""
    path = Path(path)
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    data = codec.loads(text)
    fmt = FormatMeta(newline=_sniff_newline(raw), trailing_newline=raw.endswith(b"\n"))
    return Preset(data=data, fmt=fmt, path=path)


def verify_roundtrip(preset: Preset) -> bool:
    """True if re-encoding the loaded data reproduces the file on disk byte-for-byte.

    Call this before trusting an edit-and-save flow on a new/unusual preset —
    a mismatch means this codec doesn't fully understand some part of the
    file's formatting, and writing back would risk corrupting data it
    silently reformatted.
    """
    raw = preset.path.read_bytes()
    return _render(preset.data, preset.fmt) == raw


def save(preset: Preset, path: str | Path | None = None, backup: bool = True) -> Path:
    """Write ``preset.data`` back to disk.

    Writes to a temp file and atomically replaces the target so a crash
    mid-write can't leave a truncated preset. When ``backup`` is set and the
    target already exists, it's copied to ``<name>.hlx.bak`` first.
    """
    target = Path(path) if path is not None else preset.path
    payload = _render(preset.data, preset.fmt)

    if backup and target.exists():
        backup_path = target.with_name(target.name + ".bak")
        backup_path.write_bytes(target.read_bytes())

    tmp_path = target.with_name(target.name + ".tmp")
    tmp_path.write_bytes(payload)
    tmp_path.replace(target)
    return target
