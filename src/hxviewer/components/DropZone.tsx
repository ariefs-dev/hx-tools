"use client";

import { useCallback, useRef, useState } from "react";
import { loadPreset, type LoadedPreset } from "@/lib/hlx/editor";

export function DropZone({ onLoaded }: { onLoaded: (preset: LoadedPreset) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        onLoaded(loadPreset(await file.text(), file.name));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't read that file.");
      }
    },
    [onLoaded]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
        dragging ? "border-sky-500 bg-sky-950/20" : "border-neutral-800 hover:border-neutral-600"
      }`}
    >
      <p className="text-sm text-neutral-300">Drop a .hlx preset here, or click to choose a file</p>
      <p className="text-xs text-neutral-600">
        Nothing leaves your browser — editing and export happen locally.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".hlx,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
