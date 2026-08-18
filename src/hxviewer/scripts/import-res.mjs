/**
 * Import model metadata and icons from a local HX Edit installation.
 *
 * Reads YOUR OWN licensed HX Edit `res/` folder and emits, into
 * `public/hx-res/` (gitignored):
 *
 *   catalog.json   merged model metadata — real names, category + colour,
 *                  icon filename, ordered params with display types/ranges,
 *                  and the control-formatting table
 *   icons/*.png    the referenced model + category artwork
 *
 * Nothing here is redistributed: the data goes Line 6 -> your machine -> this
 * app's gitignored output folder. Same approach as the community editors in
 * ../vendor (fretwire, openpodgo), which ship neutral placeholders and let the
 * user supply their own already-licensed resources locally.
 *
 * Usage:
 *   npm run import-res                 # auto-detect the install
 *   npm run import-res -- "<res dir>"  # explicit path
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, copyFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "public", "hx-res");
const OUT_ICONS = join(OUT_DIR, "icons");

const CANDIDATE_PATHS = [
  "C:/Program Files (x86)/Line6/HX Edit/res",
  "C:/Program Files/Line6/HX Edit/res",
  "/Applications/HX Edit.app/Contents/Resources/res",
  "/Applications/Line 6/HX Edit.app/Contents/Resources/res",
];

function findResDir() {
  const explicit = process.argv[2];
  if (explicit) {
    // Accept either the res folder itself or the install root containing it.
    const asRes = resolve(explicit);
    if (existsSync(join(asRes, "HX_ModelCatalog.json"))) return asRes;
    const nested = join(asRes, "res");
    if (existsSync(join(nested, "HX_ModelCatalog.json"))) return nested;
    throw new Error(`No HX_ModelCatalog.json found in "${explicit}" (or its res/ subfolder).`);
  }
  for (const p of CANDIDATE_PATHS) {
    if (existsSync(join(p, "HX_ModelCatalog.json"))) return p;
  }
  throw new Error(
    "Couldn't auto-detect an HX Edit install. Pass the path explicitly:\n" +
      '  npm run import-res -- "C:/Program Files (x86)/Line6/HX Edit/res"'
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** "0xf5901e" -> "#f5901e" */
function toCssColor(raw) {
  if (typeof raw !== "string") return null;
  const hex = raw.replace(/^0x/i, "").padStart(6, "0");
  return `#${hex.toLowerCase()}`;
}

/**
 * The catalog gives icons + category (with colour); the .models files give
 * param definitions and DSP cost. Model ids (`symbolicID` / `id`) join them,
 * and are exactly the `@model` strings found in a .hlx preset.
 */
function collectCatalog(resDir) {
  const cat = readJson(join(resDir, "HX_ModelCatalog.json"));
  const categories = {};
  const byModel = new Map();

  for (const c of cat.categories ?? []) {
    categories[c.id] = {
      name: c.name,
      shortName: c.shortName ?? c.name,
      color: toCssColor(c.color),
      icon: c.image && c.image !== "None" ? c.image : null,
    };

    const groups = [{ models: c.models ?? [] }, ...(c.subcategories ?? [])];
    for (const g of groups) {
      for (const m of g.models ?? []) {
        if (!m?.id) continue;
        // The catalog's params array carries display-label overrides, e.g.
        // { "ChVol": "Ch Vol" } — the key is the symbolic id, the value the
        // label HX Edit actually shows (null = use the id as-is).
        const labels = {};
        for (const entry of m.params ?? []) {
          for (const [id, label] of Object.entries(entry ?? {})) {
            if (label) labels[id] = label;
          }
        }
        // A model id can appear more than once (typically a Mono entry that
        // carries the artwork plus a Stereo entry with "image": "None").
        // Merge rather than overwrite, or the icon-less duplicate wins and
        // ~150 models silently lose their artwork.
        const prev = byModel.get(m.id);
        const icon = m.image && m.image !== "None" ? m.image : null;
        byModel.set(m.id, {
          name: prev?.name ?? m.name ?? null,
          icon: prev?.icon ?? icon,
          category: prev?.category ?? c.id,
          subcategory: prev?.subcategory ?? g.name ?? null,
          labels: { ...labels, ...(prev?.labels ?? {}) },
        });
      }
    }
  }
  return { categories, byModel };
}

function collectModelDefs(resDir) {
  const defs = new Map();
  const files = readdirSync(resDir).filter((f) => f.endsWith(".models"));
  for (const file of files) {
    let parsed;
    try {
      parsed = readJson(join(resDir, file));
    } catch (e) {
      console.warn(`  ! skipping ${file}: ${e.message}`);
      continue;
    }
    for (const m of parsed ?? []) {
      if (!m?.symbolicID) continue;
      const params = (m.params ?? [])
        // Most '@'-prefixed entries are structural (@enabled, @stereo,
        // @cursor_*) and belong in the metadata section, not the knob list.
        // But some are genuine user-facing controls (@mic, @trails,
        // @bypassvolume, the Powercab/Variax/DT settings). The data itself
        // draws that line: the real controls carry a displayType, the
        // structural ones don't.
        .filter((p) => p?.symbolicID && (!p.symbolicID.startsWith("@") || p.displayType))
        .map((p) => ({
          id: p.symbolicID,
          name: p.name ?? p.symbolicID,
          type: p.displayType ?? null,
          min: p.min ?? null,
          max: p.max ?? null,
          default: p.default ?? null,
        }));
      defs.set(m.symbolicID, {
        name: m.name ?? null,
        mono: m.mono ?? null,
        stereo: m.stereo ?? null,
        load: m.load ?? null,
        loadStereo: m.load_stereo ?? null,
        params,
      });
    }
  }
  return defs;
}

/** Resolve `{ alias: "other" }` indirection so the client needs no lookup loop. */
function collectControls(resDir, usedTypes) {
  const controls = readJson(join(resDir, "HelixControls.json"));
  const resolved = {};
  for (const type of usedTypes) {
    if (!type) continue;
    let entry = controls[type];
    const seen = new Set([type]);
    while (entry?.alias && !seen.has(entry.alias)) {
      seen.add(entry.alias);
      entry = controls[entry.alias];
    }
    if (entry) resolved[type] = entry;
  }
  return resolved;
}

function main() {
  const resDir = findResDir();
  console.log(`Reading HX Edit resources from:\n  ${resDir}\n`);

  const { categories, byModel } = collectCatalog(resDir);
  const defs = collectModelDefs(resDir);
  console.log(`  catalog entries: ${byModel.size}`);
  console.log(`  model defs:      ${defs.size}`);

  const models = {};
  const usedTypes = new Set();
  const ids = new Set([...byModel.keys(), ...defs.keys()]);

  for (const id of ids) {
    const c = byModel.get(id);
    const d = defs.get(id);
    const params = d?.params ?? [];
    for (const p of params) {
      usedTypes.add(p.type);
      // Prefer the catalog's display label when it overrides the raw id.
      const override = c?.labels?.[p.id];
      if (override) p.name = override;
    }
    models[id] = {
      name: c?.name ?? d?.name ?? null,
      icon: c?.icon ?? null,
      category: c?.category ?? null,
      subcategory: c?.subcategory ?? null,
      mono: d?.mono ?? null,
      stereo: d?.stereo ?? null,
      load: d?.load ?? null,
      loadStereo: d?.loadStereo ?? null,
      params,
    };
  }

  const controls = collectControls(resDir, usedTypes);
  console.log(`  control types:   ${Object.keys(controls).length}`);

  // Fresh output each run, so a re-import never leaves stale icons behind.
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_ICONS, { recursive: true });

  const iconDirs = [join(resDir, "icons_models"), join(resDir, "icons_category")];
  const wanted = new Set();
  for (const m of Object.values(models)) if (m.icon) wanted.add(m.icon);
  for (const c of Object.values(categories)) if (c.icon) wanted.add(c.icon);

  let copied = 0;
  const missing = [];
  for (const icon of wanted) {
    const src = iconDirs.map((d) => join(d, icon)).find((p) => existsSync(p));
    if (!src) {
      missing.push(icon);
      continue;
    }
    copyFileSync(src, join(OUT_ICONS, basename(icon)));
    copied++;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: resDir,
    note:
      "Generated from a local HX Edit installation by scripts/import-res.mjs. " +
      "Proprietary Line 6 data — do not commit or redistribute.",
    categories,
    models,
    controls,
  };
  writeFileSync(join(OUT_DIR, "catalog.json"), JSON.stringify(payload));

  const withName = Object.values(models).filter((m) => m.name).length;
  const withIcon = Object.values(models).filter((m) => m.icon).length;
  console.log(`\nWrote ${OUT_DIR}`);
  console.log(`  models:      ${Object.keys(models).length} (${withName} named, ${withIcon} with icons)`);
  console.log(`  icons:       ${copied} copied${missing.length ? `, ${missing.length} missing` : ""}`);
  if (missing.length) console.log(`               missing: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`);
  console.log(`\nThis output is gitignored and stays on your machine.`);
}

main();
