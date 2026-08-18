# hx-tools

Two independent, clean-room tools for **Line 6 Helix / HX** presets:

| | |
|---|---|
| **[`src/hxcli`](src/hxcli)** | `hx` — a Python CLI **and MCP server** for reading, explaining, diffing and safely editing `.hlx` preset files. |
| **[`src/hxviewer`](src/hxviewer)** | `hx viewer` — a browser app that renders a preset as a signal chain *and* as the device's own panel, edits it, and exports it back. |

Built and tested against a **Helix LT** on firmware 3.80. The `.hlx` format is shared across the
Helix Floor/LT/Rack and HX Stomp/Stomp XL/Effects family.

## Why these exist

A `.hlx` preset is plain JSON — but written in a style `json.dumps` / `JSON.stringify` do not
reproduce: a space before every colon, and floats printed with C's `%.17g` rather than the shortest
round-trip form. Saving a preset with a stock JSON library silently rewrites every number in it.

Both tools carry a byte-exact codec, so they can promise something concrete:

- loading a preset and saving it **unedited** reproduces the original file **byte for byte**;
- editing one parameter changes **exactly the one line** that parameter lives on.

That round-trip doubles as a safety gate: if a file doesn't re-encode exactly, the tools say so
instead of quietly handing back a reformatted preset.

## What they can do

Read and explain a preset · diff two snapshots · edit parameters in real units · bypass blocks ·
reorder blocks · swap a block's model · add and remove effects blocks · recall and rename
snapshots · export a `.hlx` you can import in HX Edit.

The viewer additionally draws the hardware: the signal-flow grid, six knobs pointing at their
values, the twelve footswitches with their scribble strips and LED rings, Stomp/Snapshot modes, and
the LT's Performance view.

## No Line 6 assets are included

Neither tool bundles Line 6 artwork, model names, or a parameter catalog. Out of the box the viewer
shows neutral placeholder icons and raw model ids, and it works fine that way.

To see real names, artwork, units and DSP costs, `npm run import-res` reads them from **your own
licensed HX Edit installation** into a gitignored folder. The data goes Line 6 → your machine →
your local build, and is never redistributed — the same approach the community editors
(`fretwire`, `openpodgo`) take.

For the same reason this repository contains **no manuals or PDFs**: the Line 6 documentation used
as reference while building this is copyrighted and stays local.

## Reference projects

The community projects consulted while working out the format are **not** vendored here — each
carries its own licence and history. Clone them yourself if you want them:

```bash
mkdir -p src/vendor && cd src/vendor
git clone https://github.com/sensorium/phelix              # GPL-3 — facts only, do not copy code
git clone https://github.com/allansomensi/openhx           # MIT — USB protocol notes
git clone https://github.com/john-baxter-dev/fretwire      # MIT/Apache-2
git clone https://github.com/agarat/openpodgo              # MIT
git clone https://github.com/AntonyCorbett/HelixBackupFiles
```

Everything here was written by reading those projects and real preset files to learn *facts* about
the format — never by copying their code or bundled data. `phelix` in particular is GPL-3; nothing
from it is reproduced in this MIT code.

## Licence

MIT — see [LICENSE](LICENSE).

Not affiliated with, endorsed, or sponsored by Line 6 or Yamaha Guitar Group. "Line 6", "Helix",
"HX", and "HX Edit" are trademarks of their respective owners, used here only to identify the
hardware and software these tools interoperate with.
