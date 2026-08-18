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
  const [view, setView] = useState<"editor" | "hardware">("editor");
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
  const addable = useMemo(() => addableModels(catalog), [catalog]);
  const amps = useMemo(() => ampModels(catalog), [catalog]);
  const cabs = useMemo(() => cabModels(catalog), [catalog]);
  const dirty = useMemo(
    () => (preset ? isDirty(preset) : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, revision]
  );

  const selectedBlock: HlxBlock | null =
    selectedPath && selectedSlot
      ? ((paths[selectedPath]?.[selectedSlot] as HlxBlock | undefined) ?? null)
      : null;

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
            className="w-64 rounded border border-transparent bg-transparent text-lg font-semibold text-neutral-100 hover:border-neutral-700 focus:border-sky-600 focus:outline-none"
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
        onSelect={(index) => {
          selectSnapshot(preset.data, index);
          touch();
        }}
        onRename={(key, name) => {
          renameSnapshot(preset.data, key, name);
          touch();
        }}
      />

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
          info={describeBlock(
            selectedBlock,
            catalog,
            new Set(
              Object.keys(selectedBlock).filter((key) =>
                isSnapshotControlled(preset.data, selectedPath, selectedSlot, key)
              )
            )
          )}
          candidates={swapCandidates(selectedBlock, catalog)}
          canMoveEarlier={canMoveBlock(paths[selectedPath], selectedSlot, "earlier")}
          canMoveLater={canMoveBlock(paths[selectedPath], selectedSlot, "later")}
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
            catalog && selectedBlock["@model"] &&
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
