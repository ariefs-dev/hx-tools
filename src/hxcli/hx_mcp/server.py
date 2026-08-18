"""MCP server exposing hx_cli's preset reading/editing as tools.

Point an MCP client (Claude Desktop, Claude Code, etc.) at a ``.hlx`` file and
ask what it does, how two snapshots differ, or to change a parameter — no
need to know the raw JSON layout. Every tool here is a thin wrapper over
:mod:`hx_cli`; the actual parsing/formatting/safety-gate logic lives there so
the CLI and the MCP server can never drift apart on what counts as a valid
edit.

Write tools (currently just :func:`set_param`) go through the same gate as
the ``hx set-param`` CLI command: refuse to touch a file that doesn't
round-trip byte-exact through the codec first, back up the previous contents,
and write atomically.
"""

from __future__ import annotations

from typing import Any

from mcp.server.mcpserver import MCPServer

from hx_cli import diff as diff_mod
from hx_cli import edit as edit_mod
from hx_cli import explain as explain_mod
from hx_cli import io as io_mod
from hx_cli import model

server = MCPServer(
    "hx-cli",
    version="0.1.0",
    instructions=(
        "Tools for reading and editing Line 6 Helix .hlx preset files (Helix Floor/LT/Rack, "
        "HX Stomp/Stomp XL/Effects). Point any tool at a .hlx file path. Editing is limited to "
        "parameters that already exist on a block in the file — this server does not add, "
        "remove, or reorder blocks."
    ),
)


def _load(path: str) -> io_mod.Preset:
    try:
        return io_mod.load(path)
    except FileNotFoundError:
        raise ValueError(f"No such file: {path}") from None
    except UnicodeDecodeError:
        raise ValueError(f"{path} isn't valid UTF-8 text — is it really a .hlx preset?") from None


@server.tool()
def read_preset(path: str) -> dict[str, Any]:
    """Load a .hlx preset and return its structure: every block per DSP path (with
    model id and on/off state, in signal-chain order) and the list of snapshots."""
    preset = _load(path)
    return model.to_dict(preset.data)


@server.tool()
def explain_preset(path: str) -> str:
    """Human-readable signal-chain summary of a .hlx preset, path by path."""
    preset = _load(path)
    return explain_mod.explain(preset.data)


@server.tool()
def list_snapshots(path: str) -> list[dict[str, str]]:
    """List a .hlx preset's snapshot keys (e.g. "snapshot0") and their display names."""
    preset = _load(path)
    return [{"key": key, "name": snap.get("@name", "")} for key, snap in model.snapshots(preset.data)]


@server.tool()
def diff_snapshots(path: str, snapshot_a: str, snapshot_b: str) -> list[dict[str, Any]]:
    """What differs between two snapshots in a preset, e.g. snapshot_a="snapshot0",
    snapshot_b="snapshot1". Returns every changed field with its before/after value."""
    preset = _load(path)
    try:
        diffs = diff_mod.diff_snapshots(preset.data, snapshot_a, snapshot_b)
    except KeyError as e:
        raise ValueError(str(e)) from None
    return [{"path": p, "before": a, "after": b} for p, a, b in diffs]


@server.tool()
def validate_preset(path: str) -> dict[str, Any]:
    """Confirm this codec fully round-trips the preset byte-exact. Call this before trusting
    set_param on a file you haven't seen before — a mismatch means some part of the file's
    formatting isn't understood, and writing back would risk silently corrupting it."""
    preset = _load(path)
    return {"path": str(preset.path), "roundtrips_byte_exact": io_mod.verify_roundtrip(preset)}


@server.tool()
def get_param(path: str, dsp: str, block: str, param: str) -> Any:
    """Read one parameter's current value from an existing block.
    dsp is e.g. "dsp0", block is e.g. "block0", param is e.g. "Drive"."""
    preset = _load(path)
    try:
        return edit_mod.get_param(preset.data, dsp, block, param)
    except KeyError as e:
        raise ValueError(str(e)) from None


@server.tool()
def set_param(
    path: str,
    dsp: str,
    block: str,
    param: str,
    value: Any,
    out: str | None = None,
    backup: bool = True,
) -> dict[str, Any]:
    """Set one parameter on an existing block and write the preset back to disk.

    Refuses to edit a file that doesn't round-trip byte-exact through the codec first.
    Writes atomically (temp file + rename) and, unless backup=False, copies the previous
    contents to <path>.bak before overwriting. Pass out= to write to a different path and
    leave the original untouched. Returns the before/after value so the caller can confirm
    the change landed as intended.
    """
    preset = _load(path)
    if not io_mod.verify_roundtrip(preset):
        raise ValueError(
            f"{path} does not round-trip byte-exact through the codec; refusing to edit a file "
            "whose format isn't fully understood. Run validate_preset for details."
        )
    try:
        before = edit_mod.get_param(preset.data, dsp, block, param)
        edit_mod.set_param(preset.data, dsp, block, param, value)
    except (KeyError, TypeError) as e:
        raise ValueError(str(e)) from None

    target = io_mod.save(preset, path=out, backup=backup)
    after = edit_mod.get_param(preset.data, dsp, block, param)
    return {
        "path": str(target),
        "dsp": dsp,
        "block": block,
        "param": param,
        "before": before,
        "after": after,
    }


def main() -> None:
    server.run()


if __name__ == "__main__":
    main()
