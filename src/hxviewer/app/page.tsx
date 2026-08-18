import { PresetViewer } from "@/components/PresetViewer";

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-neutral-400">
          hx viewer
        </h1>
        <p className="text-xs text-neutral-600">
          Line 6 Helix / HX .hlx preset viewer — parses locally in your browser
        </p>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <PresetViewer />
      </main>
    </div>
  );
}
