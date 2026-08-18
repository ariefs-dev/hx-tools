# hx-cli

Read, inspect, and safely edit Line 6 Helix `.hlx` preset files from the command line.

Built for a Helix LT on firmware 3.80, but the format is shared across the Helix Floor/LT/Rack
and HX Stomp/Stomp XL/Effects family.

## Why this exists

A `.hlx` preset (what HX Edit imports/exports, and what you'd drag onto your device) turns out to
be plain JSON — no proprietary binary encoding. But it's JSON with a specific formatting quirk:
Helix prints floats at full double precision (`%.17g`) rather than the shortest round-trip
representation, uses `"key" : value` (space before the colon), and lowercase `true`/`false`.
Round-tripping through a stock JSON library silently reformats every number in the file.

`hx_cli.codec` reproduces Helix's exact byte layout, so loading a preset and re-saving it
unmodified is byte-identical to the original. That byte-exact round-trip is the safety gate
`hx_cli.io.save()` checks before ever overwriting a real preset: if we can't prove we understood
the file, we don't write to it.

## Install

```bash
cd src/hxcli
pip install -e .
```

## Usage

```bash
hx explain MyPreset.hlx        # human-readable signal chain, path by path
hx snapshots MyPreset.hlx      # list snapshot names
hx diff MyPreset.hlx snapshot0 snapshot1   # what changes between two snapshots
hx validate MyPreset.hlx       # confirm the codec fully round-trips this file
hx set-param MyPreset.hlx --dsp dsp0 --block block0 --param Drive --value 0.8
```

`set-param` writes a `.bak` of the previous contents before overwriting (unless `--no-backup`),
and writes atomically (temp file + rename) so an interrupted write can't corrupt the preset.

## MCP server

`hx_mcp` exposes the same functionality as MCP tools, so an MCP client (Claude Desktop, Claude
Code, etc.) can read and edit `.hlx` files directly.

```bash
pip install -e ".[mcp]"
```

Add it to your client's config:

```json
{
  "mcpServers": {
    "hx-cli": {
      "command": "hx-mcp"
    }
  }
}
```

Tools: `read_preset`, `explain_preset`, `list_snapshots`, `diff_snapshots`, `validate_preset`,
`get_param`, `set_param`. `set_param` goes through the same safety gate as `hx set-param` —
it refuses to edit a file that doesn't round-trip byte-exact, and backs up before writing.

## Scope (v0.1)

- Reads and edits **existing** parameter values on **existing** blocks.
- Does **not** add/remove/reorder blocks or know a block's default parameters — that needs a
  model catalog (id -> friendly name, parameter ranges/units), which is intentionally not
  bundled here yet (see Licensing below).
- Operates on standalone `.hlx` files, not live USB communication with the hardware. Edit the
  file, then import it via HX Edit or by copying it to the device.
- The MCP server wraps the same read/edit surface for MCP clients; it does not run/control the
  hardware either.

## Licensing

MIT, clean-room. The `.hlx` format facts here (structure, the `%.17g` float quirk, the
`"key" : value` spacing) were determined by inspecting real preset files and cross-referencing
publicly documented format notes from the wider Helix tooling community — no code or data was
copied from any GPL-licensed project. If a future version bundles a model catalog, check that
catalog's own provenance/license before assuming it's compatible with MIT redistribution.

Not affiliated with or endorsed by Line 6 or Yamaha Guitar Group. "Line 6" and "Helix" are
trademarks of their respective owners, used here only to describe compatibility.
