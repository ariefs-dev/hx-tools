"""``hx`` command-line entry point."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import diff as diff_mod
from . import edit as edit_mod
from . import explain as explain_mod
from . import io as io_mod
from . import model


def _cmd_explain(args: argparse.Namespace) -> int:
    preset = io_mod.load(args.file)
    print(explain_mod.explain(preset.data))
    return 0


def _cmd_validate(args: argparse.Namespace) -> int:
    preset = io_mod.load(args.file)
    ok = io_mod.verify_roundtrip(preset)
    if ok:
        print(f"OK: {args.file} round-trips byte-exact")
        return 0
    print(f"MISMATCH: {args.file} does not round-trip byte-exact — codec doesn't fully understand this file")
    return 1


def _cmd_snapshots(args: argparse.Namespace) -> int:
    preset = io_mod.load(args.file)
    for key, snap in model.snapshots(preset.data):
        print(f"{key}: {snap.get('@name')}")
    return 0


def _cmd_diff(args: argparse.Namespace) -> int:
    preset = io_mod.load(args.file)
    diffs = diff_mod.diff_snapshots(preset.data, args.snapshot_a, args.snapshot_b)
    if not diffs:
        print("No differences.")
        return 0
    for path, a, b in diffs:
        print(f"{path}: {a!r} -> {b!r}")
    return 0


def _cmd_set_param(args: argparse.Namespace) -> int:
    preset = io_mod.load(args.file)
    edit_mod.set_param(preset.data, args.dsp, args.block, args.param, args.value)
    out_path = Path(args.out) if args.out else preset.path
    io_mod.save(preset, path=out_path, backup=not args.no_backup)
    print(f"Wrote {out_path}")
    return 0


def _parse_value(raw: str):
    if raw.lower() in ("true", "false"):
        return raw.lower() == "true"
    try:
        return int(raw)
    except ValueError:
        pass
    try:
        return float(raw)
    except ValueError:
        return raw


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="hx", description="Work with Line 6 Helix .hlx preset files.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_explain = sub.add_parser("explain", help="Print a human-readable signal-chain summary")
    p_explain.add_argument("file")
    p_explain.set_defaults(func=_cmd_explain)

    p_validate = sub.add_parser("validate", help="Check the preset round-trips byte-exact through the codec")
    p_validate.add_argument("file")
    p_validate.set_defaults(func=_cmd_validate)

    p_snapshots = sub.add_parser("snapshots", help="List snapshot names")
    p_snapshots.add_argument("file")
    p_snapshots.set_defaults(func=_cmd_snapshots)

    p_diff = sub.add_parser("diff", help="Diff two snapshots within a preset")
    p_diff.add_argument("file")
    p_diff.add_argument("snapshot_a", help='e.g. "snapshot0"')
    p_diff.add_argument("snapshot_b", help='e.g. "snapshot1"')
    p_diff.set_defaults(func=_cmd_diff)

    p_set = sub.add_parser("set-param", help="Set a parameter on an existing block")
    p_set.add_argument("file")
    p_set.add_argument("--dsp", required=True, help='e.g. "dsp0"')
    p_set.add_argument("--block", required=True, help='e.g. "block0"')
    p_set.add_argument("--param", required=True, help='e.g. "Drive"')
    p_set.add_argument("--value", required=True, type=_parse_value)
    p_set.add_argument("--out", help="Write to a different path instead of overwriting")
    p_set.add_argument("--no-backup", action="store_true", help="Skip writing a .bak file")
    p_set.set_defaults(func=_cmd_set_param)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
