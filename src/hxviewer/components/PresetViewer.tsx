"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dspPaths, presetName, type HlxBlock } from "@/lib/hlx/model";
import {
  isSnapshotControlled,
  selectSnapshot,
  summarizeSnapshots,
} from "@/lib/hlx/snapshots";
import { loadCatalog, type Catalog } from "@/lib/hlx/catalog";
import { describeBlock } from "@/lib/hlx/display";
import {
  downloadPreset,
  isDirty,
  renamePreset,
  renameSnapshot,
  revertPreset,
  setBlockEnabled,
  setParam,
  type LoadedPreset,
} from "@/lib/hlx/editor";
import {
  addAmpCab,
  addBlock,
  addableModels,
  ampModels,
  cabModels,
  canAddAmp,
  canAddBlock,
  canMoveBlock,
  moveBlock,
  removeBlock,
  setAmpCab,
  swapCandidates,
  swapModel,
  type MoveDirection,
} from "@/lib/hlx/restructure";
import { DropZone } from "./DropZone";
import { SignalChain } from "./SignalChain";
import { ParamPanel } from "./ParamPanel";
import { SnapshotList } from "./SnapshotList";
import { HardwareView } from "./HardwareView";
import { AddBlockBar } from "./AddBlockBar";

export function PresetViewer() {
  const [preset, setPreset] = useState<LoadedPreset | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogChecked, setCatalogChecked] = useState(false);
  // A preset opens in the hardware view, which is read-only: you see it as the
  // device shows it, and nothing can be changed until you switch to Editor.
  const [view, setView] = useState<"editor" | "hardware">("hardware");
  const [paramPage, setParamPage] = useState(0);

  // Edits mutate the parsed tree in place (it's large, and edits are
  // pointwise); bumping this forces the re-render rather than cloning.
  const [revision, setRevision] = useState(0);
  const touch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    loadCatalog().then((c) => {
      if (cancelled) return;
      setCatalog(c);
      setCatalogChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const paths = useMemo(
    () => (preset ? dspPaths(preset.data) : {}),
    // revision participates so in-place edits refresh derived views
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, revision]
  );
  const snaps = useMemo(
    () => (preset ? summarizeSnapshots(preset.data) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, revision]
  );
  const readOnly = view === "hardware";
  const addable = useMemo(() => addableModels(catalog), [catalog]);
  const amps = useMemo(() => ampModels(catalog), [catalog]);
  const cabs = useMemo(() => cabModels(catalog), [catalog]);
  const dirty = useMemo(
    () => (preset ? isDirty(preset) : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, revision]
  );

  // An Amp+Cab and a Dual Cab are each one block on the hardware but two slots
  // in the file; the second is named by @cab and has no @position of its own.
  const linkedSlot =
    selectedPath && selectedSlot
      ? ((paths[selectedPath]?.[selectedSlot] as HlxBlock | undefined)?.["@cab"] as
          | string
          | undefined)
      : undefined;

  const selectedBlock: HlxBlock | null =
    selectedPath && selectedSlot
      ? ((paths[selectedPath]?.[selectedSlot] as HlxBlock | undefined) ?? null)
      : null;

  const linkedCab =
    selectedPath && linkedSlot
      ? (() => {
          const block = paths[selectedPath]?.[linkedSlot] as HlxBlock | undefined;
          if (!block) return null;
          return {
            slot: linkedSlot,
            block,
            info: describe(block, selectedPath, linkedSlot),
            candidates: readOnly ? [] : swapCandidates(block, catalog),
          };
        })()
      : null;

  function describe(block: HlxBlock, dspKey: string, slot: string) {
    return describeBlock(
      block,
      catalog,
      new Set(
        Object.keys(block).filter((key) => isSnapshotControlled(preset!.data, dspKey, slot, key))
      )
    );
  }

  function select(dspKey: string, slot: string) {
    setSelectedPath(dspKey);
    setSelectedSlot(slot);
    setParamPage(0);
    touch();
  }

  function handleLoaded(loaded: LoadedPreset) {
    setPreset(loaded);
    setSelectedPath(null);
    setSelectedSlot(null);
    setRevision(0);
  }

  const catalogBanner = catalogChecked && !catalog && (
    <p className="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-500">
      Showing placeholder icons and raw model ids. Run{" "}
      <code className="font-mono text-neutral-300">npm run import-res</code> to pull real names,
      artwork, and units from your own HX Edit install.
    </p>
  );

  if (!preset) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <DropZone onLoaded={handleLoaded} />
        {catalogBanner}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <input
            value={presetName(preset.data)}
            onChange={(e) => {
              renamePreset(preset.data, e.target.value);
              touch();
            }}
            aria-label="Preset name"
            readOnly={readOnly}
            className={`w-64 rounded border border-transparent bg-transparent text-lg font-semibold text-neutral-100 focus:outline-none ${
              readOnly ? "cursor-default" : "hover:border-neutral-700 focus:border-sky-600"
            }`}
          />
          <p className="text-xs text-neutral-500">
            {preset.filename}
            {dirty && <span className="ml-2 text-amber-500">&bull; edited</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-neutral-800">
            {(["editor", "hardware"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                  view === mode
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => {
              setPreset(revertPreset(preset));
              setRevision(0);
            }}
            className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 enabled:hover:border-neutral-600 disabled:opacity-40"
          >
            Revert
          </button>
          <button
            type="button"
            onClick={() => downloadPreset(preset)}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
          >
            Export .hlx
          </button>
          <button
            type="button"
            onClick={() => setPreset(null)}
            className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
          >
            Close
          </button>
        </div>
      </div>

      {readOnly && (
        <p className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-400">
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
            Read only
          </span>
          Viewing this preset as the device shows it. Switch to{" "}
          <button
            type="button"
            onClick={() => setView("editor")}
            className="font-semibold text-sky-400 underline underline-offset-2 hover:text-sky-300"
          >
            Editor
          </button>{" "}
          to make changes.
        </p>
      )}

      {!preset.roundTrips && (
        <p className="rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          This file doesn&apos;t re-encode byte-for-byte, so exporting will reformat parts of it that
          weren&apos;t edited. The values themselves are read correctly — keep a backup of the
          original before importing an export of this preset.
        </p>
      )}

      {catalogBanner}

      <SnapshotList
        snapshots={snaps}
        readOnly={readOnly}
        onSelect={(index) => {
          selectSnapshot(preset.data, index);
          touch();
        }}
        onRename={(key, name) => {
          renameSnapshot(preset.data, key, name);
          touch();
        }}
      />

      {!readOnly && (
      <AddBlockBar
        catalog={catalog}
        models={addable}
        amps={amps}
        cabs={cabs}
        paths={Object.keys(paths)}
        checkEffect={(modelId, dspKey, branch) =>
          canAddBlock(preset.data, catalog, modelId, dspKey, branch)
        }
        checkAmp={(modelId, dspKey, branch) =>
          canAddAmp(preset.data, catalog, modelId, dspKey, branch)
        }
        onAddEffect={(modelId, dspKey, branch) => {
          if (!catalog) return;
          select(dspKey, addBlock(preset.data, catalog, modelId, dspKey, branch));
        }}
        onAddAmp={(ampId, cabId, dspKey, branch) => {
          if (!catalog) return;
          select(dspKey, addAmpCab(preset.data, catalog, ampId, cabId, dspKey, branch));
        }}
      />
      )}

      {view === "hardware" ? (
        <HardwareView
          preset={preset.data}
          catalog={catalog}
          selectedPath={selectedPath}
          selectedSlot={selectedSlot}
          onSelect={(dspKey, slot) => {
            setSelectedPath(dspKey);
            setSelectedSlot(slot);
            setParamPage(0);
          }}
          onSelectSnapshot={(index) => {
            selectSnapshot(preset.data, index);
            touch();
          }}
          page={paramPage}
          onPageChange={setParamPage}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(paths).map(([dspKey, dsp]) => (
            <SignalChain
              key={dspKey}
              pathLabel={`Path ${Number(dspKey.slice(3)) + 1} (${dspKey})`}
              dsp={dsp}
              catalog={catalog}
              selectedSlot={selectedPath === dspKey ? selectedSlot : null}
              onSelectSlot={(slot) => {
                setSelectedPath(dspKey);
                setSelectedSlot(slot);
              }}
            />
          ))}
        </div>
      )}

      {selectedBlock && selectedPath && selectedSlot && (
        <ParamPanel
          slot={selectedSlot}
          block={selectedBlock}
          info={describe(selectedBlock, selectedPath, selectedSlot)}
          readOnly={readOnly}
          candidates={readOnly ? [] : swapCandidates(selectedBlock, catalog)}
          canMoveEarlier={!readOnly && canMoveBlock(paths[selectedPath], selectedSlot, "earlier")}
          canMoveLater={!readOnly && canMoveBlock(paths[selectedPath], selectedSlot, "later")}
          linked={linkedCab}
          onParamChange={(param, value) => {
            setParam(preset.data, selectedPath, selectedSlot, param, value);
            touch();
          }}
          onToggleEnabled={(enabled) => {
            setBlockEnabled(preset.data, selectedPath, selectedSlot, enabled);
            touch();
          }}
          onMove={(direction: MoveDirection) => {
            moveBlock(preset.data, selectedPath, selectedSlot, direction);
            touch();
          }}
          onSwapModel={(modelId) => {
            if (!catalog) return;
            swapModel(preset.data, selectedPath, selectedSlot, modelId, catalog);
            touch();
          }}
          cabs={
            !readOnly && catalog && selectedBlock["@model"] &&
            [11, 12].includes(catalog.models[selectedBlock["@model"] as string]?.category ?? -1)
              ? cabs
              : undefined
          }
          currentCab={
            typeof selectedBlock["@cab"] === "string"
              ? ((paths[selectedPath]?.[selectedBlock["@cab"] as string] as HlxBlock | undefined)?.[
                  "@model"
                ] as string | undefined) ?? null
              : null
          }
          onSetCab={(cabModelId) => {
            if (!catalog) return;
            setAmpCab(preset.data, catalog, selectedPath, selectedSlot, cabModelId);
            touch();
          }}
          onLinkedParamChange={(param, value) => {
            if (!linkedCab) return;
            setParam(preset.data, selectedPath, linkedCab.slot, param, value);
            touch();
          }}
          onLinkedSwapModel={(modelId) => {
            if (!catalog || !linkedCab) return;
            swapModel(preset.data, selectedPath, linkedCab.slot, modelId, catalog);
            touch();
          }}
          onLinkedToggleEnabled={(enabled) => {
            if (!linkedCab) return;
            setBlockEnabled(preset.data, selectedPath, linkedCab.slot, enabled);
            touch();
          }}
          onRemove={() => {
            removeBlock(preset.data, selectedPath, selectedSlot);
            setSelectedSlot(null);
            setSelectedPath(null);
            touch();
          }}
        />
      )}

    </div>
  );
}
