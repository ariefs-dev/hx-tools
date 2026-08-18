# hx viewer

A browser-based viewer **and editor** for Line 6 Helix / HX `.hlx` presets — drop in a preset,
see its signal chain laid out block by block, tweak parameters, and export the result back to a
`.hlx` you can import in HX Edit. Everything runs client-side; nothing you open ever leaves your
browser.

## Two views

**Editor** — the working view: chain, parameter panel with sliders, model picker.

**Hardware** — the device panel, drawn from the **Helix LT** Owner's Manual and LT Cheat Sheet:

- **The LCD**, with a `VIEW` button that toggles the LT's two Home views, as its real VIEW button
  does:
  - *Signal Flow* — each path as a slot grid with an upper row A and lower row B, inputs and
    outputs pinned to the ends, split/merge on the spine, an Amp and the cab it names drawn as one
    Amp+Cab slot, the selected block outlined in white, bypassed blocks dimmed.
  - *Performance* — the LT's grid of "the middle eight footswitches' assignments, so you know
    exactly what you're stomping on in the heat of battle", four across and two down.
- **Knobs 1–6** beneath their parameter cells, six per page with a page indicator — the hardware's
  `<PAGE/PAGE>` behaviour. Each pointer sits at the value's position in its range, so the row
  reads at a glance.
- **Twelve footswitches**, `FS1…FS6` over `FS7…FS12`. FS1/FS7 are BANK up/down, FS6 toggles
  Preset/Stomp mode, FS12 is TAP (hold for tuner), leaving "the middle eight footswitches"
  (FS2–5, FS8–11) for blocks, each with an LED ring that lights when its block is on.
- **Snapshot footswitch mode**: FS6 flips the middle eight to snapshots 1–8, and pressing one
  recalls it, exactly as on the hardware.

Selecting a block works in either view, and the edit panel stays available underneath, so you can
navigate the way the hardware does and still edit with sliders.

Two things are deliberately *not* faked, because the data doesn't support them:

- `@fs_ledcolor` decodes to implausible near-black values in several real presets, so the LED ring
  uses the block's **category colour** — which is what Helix shows unless a switch was customised.
- `@fs_index` runs 2–18, so it cannot be a switch number. Assignments fill the eight stomp
  positions in that order; the index-to-physical-switch mapping isn't publicly documented
  (fretwire's protocol notes flag the same gap).

Note the LT has **no per-switch scribble strips** — unlike the Floor, its switch labels live on the
main display, which is exactly what Performance view is for.

## Editing

- **Parameters** — sliders plus a text box, in the units HX Edit shows (Drive `7.7`, not the
  stored `0.77`). Discrete controls (mic, note division, Off/On) become dropdowns of their real
  choices; booleans become toggles. Values are clamped to each parameter's catalog range.
- **Bypass** — toggle any block on/off; the chain view dims it, matching the hardware.
- **Reorder** — move a block one slot earlier or later along its path with the arrow buttons.
- **Swap model** — pick a different model for a block; its parameters reset to that model's
  factory defaults, exactly as HX Edit does. Restricted to models in the same category (see below).
- **Add and remove blocks** — effects, and **Amp / Amp+Cab**. An amp's panel also gets a Cab
  picker, so you can change the cab, attach one to a bare Amp, or drop it back to Amp only.
  The Add button disables itself and names the reason when a documented limit would be exceeded.
- **Snapshots** — click one to recall it, exactly as the footswitches do on the hardware: its
  stored bypass states and per-snapshot parameter values are applied to the blocks. Each chip
  shows how many of its tracked blocks are on. Parameters that hold a separate value per snapshot
  are tagged `SNAP` in the panel.
- **Names** — the preset name and the active snapshot's name are editable in place (renaming a
  snapshot also sets `@custom_name`, which is how Helix knows to show your label instead of
  "SNAPSHOT n").
- **Revert** restores the file as loaded; **Export .hlx** downloads the edited preset.

### Why export is safe

`.hlx` is JSON, but written in a style `JSON.stringify` does not reproduce: a space before every
colon, and floats printed with C's `%.17g` instead of JavaScript's shortest round-trip form.
Exporting naively would silently rewrite every number in the file.

`lib/hlx/codec.ts` reproduces Helix's exact byte layout — including `%.17g`'s half-to-even
rounding in the 17th digit — and `lib/hlx/parse.ts` preserves key order, which plain `JSON.parse`
loses because JavaScript hoists integer-like keys (as found in a preset's IR table). Together they
give a real guarantee, verified against every sample preset on hand:

- loading a preset and exporting it **unedited** reproduces the original file byte for byte;
- editing one parameter changes **exactly the one line** that parameter lives on.

On load the app re-encodes the file and compares it to the source. If they don't match it warns
you before you export, rather than quietly handing back a reformatted preset. (HX Edit's own
bundled `default_preset.hlx` / `empty_preset.hlx` trip this — they ship in a different format than
the presets HX Edit and the hardware actually export.)

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run import-res     # optional, see below — real names, icons and units
```

## Two modes

**Without a catalog** (default, out of the box) the viewer ships **zero Line 6 data**:

- Category is inferred from the model id's own prefix (`lib/hlx/categorize.ts`) — Helix ids
  consistently start with their category (`HD2_Amp...`, `HD2_Dist...`).
- Names are the raw id with camelCase split into words (`AmpLine6Fatality` → "Amp Line6 Fatality").
- Icons (`lib/hlx/icons.tsx`) are small original SVGs, one per category.
- Parameters appear in raw JSON key order with raw values (`0.77`, `-29.7`).

**With a catalog imported from your own HX Edit install**, the same preset renders the way HX Edit
shows it:

| | placeholder | imported |
|---|---|---|
| name | "Dist Deranged Master" | **Deranged Master** |
| icon | generic waveform glyph | the actual pedal artwork |
| category | grey "Distortion" | **Distortion** in Line 6's own `#f5901e` |
| params | `Treble 0.650`, `Level -29.700` | `Drive 7.7`, `Level -29.7 dB` — in HX Edit's order |
| discrete values | `@mic 6` | **160 Ribbon** |
| DSP cost | — | **5.2%** |

```bash
npm run import-res                 # auto-detects a standard install
npm run import-res -- "<res dir>"  # or point it at the folder yourself
```

This reads **your own licensed** HX Edit `res/` folder and writes `public/hx-res/`
(`catalog.json` + the referenced PNGs). That output is **gitignored** — the data goes
Line 6 → your machine → your local build, and is never committed or redistributed. This is the
same approach the community editors in `../vendor` take (`fretwire`, `openpodgo`): ship neutral
placeholders, let each user supply resources they already have a licence for.

Where the data comes from, inside `res/`:

- `HX_ModelCatalog.json` — display names, icon filenames, category names + colours.
- `*.models` (`amp.models`, `delay.models`, …) — per-model parameter definitions (order, display
  type, ranges, defaults) and DSP cost.
- `HelixControls.json` — how each display type renders (scale factors, printf formats, units, and
  the literal tables behind discrete controls like mic and note division).

## Structure

- `lib/hlx/model.ts` — signal-chain walking, ported from the sibling `hx_cli/model.py`.
- `lib/hlx/codec.ts` / `parse.ts` — the byte-exact serializer and order-preserving parser.
- `lib/hlx/editor.ts` — edit operations, dirty tracking, revert, and export.
- `lib/hlx/categorize.ts` / `icons.tsx` — the no-catalog fallbacks.
- `lib/hlx/catalog.ts` — catalog types, loader, value formatter, and unit derivation.
- `lib/hlx/display.ts` — resolves a block into what the UI shows, from the catalog when present and
  the fallbacks otherwise, so components never branch on which mode is active.
- `lib/hlx/grid.ts` — the row A / row B slot layout and footswitch list behind the hardware view.
- `lib/hlx/limits.ts` — per-preset / per-path block counts, from the HX Edit Pilot's Guide.
- `lib/hlx/snapshots.ts` — snapshot selection and keeping the active snapshot's stored copy in sync.
- `lib/hlx/restructure.ts` — block reordering and model swapping.
- `scripts/import-res.mjs` — the importer.
- `components/` — `DropZone`, `SignalChain`/`BlockCard`, `ParamPanel`/`ParamControl`,
  `SnapshotList`, `HardwareView`/`FootswitchPanel`.

## How snapshots stay consistent

A preset stores each snapshot's state twice: `tone.snapshotN.blocks[dsp][slot]` holds that
snapshot's bypass state for every block and `tone.snapshotN.controllers[...]["@value"]` holds any
parameter assigned to the Snapshots controller, while the block's own `@enabled` and parameter
values mirror whichever snapshot `tone.global.@current_snapshot` names. Across the sample presets
those two copies agreed in all 203 bypass entries and all 53 controller parameters — they are
never allowed to drift.

So every edit writes both places. Editing only the top level (which is what this app did before
snapshot support existed) leaves the active snapshot's stored copy stale, and the hardware undoes
the change the moment it recalls that snapshot.

One wrinkle worth knowing if you touch `lib/hlx/snapshots.ts`: `controllers` is keyed by
container, and containers come in two shapes. A DSP path nests `block → param → entry`
(`controllers.dsp0.block6.Time`), but a device container holds parameters directly
(`controllers.variax.@variax_model`). The code detects the level from the value rather than
assuming it from the key.

Touring all eight snapshots and returning to the starting one reproduces the original file byte
for byte, across every sample preset.

## How reorder and swap stay safe

Both operations follow rules derived from the 24 real presets in `../vendor/phelix/presets`
(48 DSP paths), not from guesswork — see `lib/hlx/restructure.ts`:

- **`@position` is an index within a path branch, not a global one.** Two blocks legitimately
  share a position when their `@path` differs (0 = upper branch A, 1 = lower branch B);
  `(@path, @position)` was unique in every path examined. Moving a block therefore *exchanges*
  `@position` with its neighbour on the same branch, so the set of occupied slots never changes
  and split/join routing can't be invalidated.
- **Structural keys follow the block's category, not its model.** `@trails` appears only on
  Delay/Reverb, `@bypassvolume` and `@cab` only on Amp, and Amp blocks carry no `@stereo` at all
  (amps are mono — the Owner's Manual says so under block order and stereo imaging). A
  cross-category swap would have to synthesize or drop those keys, so swapping is limited to the
  same category, where the shape is already right. `@type` likewise tracks category
  (FX = 0, Amp = 3 with a cab / 1 without, Cab = 2, IR = 5, Looper = 6, Delay & Reverb = 7).

Exercised across every block of every sample preset — 316 moves and 449 swaps — with no position
collisions, no structural-key changes, and every result still re-parsing and round-tripping.

## Adding blocks

Block counts follow the table in the **HX Edit Pilot's Guide** ("DSP Limit and Model
Availability"), Helix Rack/Floor/LT column — four Amp/Preamp/Cab/IR blocks per preset and two per
path, one Looper per preset, and so on (`lib/hlx/limits.ts`).

An **Amp+Cab is two linked slots**, and its shape was verified against all 18 Amp+Cab blocks in
the sample presets before being written:

- the amp sits in a `blockN` slot with `@bypassvolume` and `@cab` naming its cab's slot;
  `@type` is **3** with a cab and **1** without, and an amp carries **no `@stereo`** at all.
- the cab sits in its own `cabN` slot holding only `@model`, `@enabled` and its parameters —
  no `@position`, `@path` or `@type`, because the amp decides where the pair sits.
- only the amp is registered in the snapshot bypass tables. Cab slots appear there **zero** times
  across the samples (against 1528 `blockN` references): bypassing an Amp+Cab bypasses the pair.

Parameter keys come from each model's own `symbolicID`, which genuinely differs between models —
Line 6's data spells the same cab control `EarlyReflections` in 38 models and `Early Reflections`
in 3.

Verified across every sample preset: adding a block and removing it again restores the file **byte
for byte** (336 effect cycles, 90 amp cycles, zero failures).

## Not yet supported

Standalone Cab and IR blocks (an IR carries a `@uuid` into your own IR library, which can't be
synthesized), cross-category model swaps, and creating a *new* controller assignment — existing
ones are honoured and edited correctly, but the internal controller numbering isn't documented in
any source here, so the app won't invent one.

## Licensing

MIT (see `LICENSE`) — the code only. No Line 6 assets are included in this repository, and
`npm run import-res` output is gitignored precisely so none ever are.

Not affiliated with or endorsed by Line 6 or Yamaha Guitar Group. "Line 6", "Helix", "HX", and
"HX Edit" are trademarks of their respective owners, used here only to identify the hardware and
software this interoperates with.
