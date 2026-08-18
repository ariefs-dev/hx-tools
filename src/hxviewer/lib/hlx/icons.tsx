/**
 * Original, neutral placeholder icons — one simple geometric glyph per
 * block category. Deliberately not a copy of HX Edit's actual artwork (see
 * README): these are what you see until you import your own HX Edit
 * resources for pixel-identical icons.
 */

import type { Category } from "./categorize";

const commonProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Glyph({ category }: { category: Category }) {
  switch (category) {
    case "amp":
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="1.5" />
          <circle cx="7.5" cy="12" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="16.5" cy="12" r="1.4" />
          <path d="M6 6V4.5M18 6V4.5" />
        </>
      );
    case "cab":
      return (
        <>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <circle cx="9" cy="8.5" r="2" />
          <circle cx="15" cy="8.5" r="2" />
          <circle cx="9" cy="15.5" r="2" />
          <circle cx="15" cy="15.5" r="2" />
        </>
      );
    case "distortion":
      return <path d="M3 15 L8 15 L10 6 L13 18 L16 9 L18 15 L21 15" />;
    case "dynamics":
      return (
        <>
          <path d="M4 4 L10 12 L4 20" />
          <path d="M20 4 L14 12 L20 20" />
        </>
      );
    case "eq":
      return (
        <>
          <path d="M6 21V10M6 6V3" />
          <path d="M12 21V14M12 10V3" />
          <path d="M18 21V16M18 12V3" />
          <circle cx="6" cy="8" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="18" cy="14" r="1.6" />
        </>
      );
    case "filter":
      return <path d="M3 18 L9 18 L16 6 L21 6" />;
    case "wah":
      return (
        <>
          <path d="M3 18 L12 8 L21 18" />
          <path d="M7 18 L12 12.5" />
        </>
      );
    case "pitch":
      return (
        <>
          <path d="M9 17V6l9-2v11" />
          <circle cx="7" cy="17" r="2.2" />
          <circle cx="16" cy="15" r="2.2" />
          <path d="M4 8l3-3M4 5h3v3" />
        </>
      );
    case "reverb":
      return (
        <>
          <circle cx="6" cy="12" r="1.4" />
          <path d="M11 6a8.5 8.5 0 0 1 0 12" />
          <path d="M15 3.5a12.5 12.5 0 0 1 0 17" />
        </>
      );
    case "delay":
      return (
        <>
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="11" cy="12" r="1.6" opacity="0.7" />
          <circle cx="17" cy="12" r="1.6" opacity="0.4" />
          <path d="M20 8a5 5 0 0 1 0 8" opacity="0.4" />
        </>
      );
    case "modulation":
      return <path d="M3 12c1.5-5 4.5-5 6 0s4.5 5 6 0 4.5-5 6 0" />;
    case "volumePan":
      return (
        <>
          <rect x="10" y="3" width="4" height="18" rx="2" />
          <circle cx="12" cy="9" r="1.8" fill="currentColor" stroke="none" />
        </>
      );
    case "sendReturn":
      return (
        <>
          <path d="M4 8h13M17 8l-3-3M17 8l-3 3" />
          <path d="M20 16H7M7 16l3-3M7 16l3 3" />
        </>
      );
    case "looper":
      return (
        <>
          <path d="M4 12a8 8 0 0 1 14.5-4.7" />
          <path d="M20 12a8 8 0 0 1-14.5 4.7" />
          <path d="M18 4v4h-4" />
          <path d="M6 20v-4h4" />
        </>
      );
    case "input":
      return (
        <>
          <path d="M3 12h9" />
          <path d="M8 7l4 5-4 5" />
          <rect x="14" y="4" width="7" height="16" rx="1" />
        </>
      );
    case "output":
      return (
        <>
          <rect x="3" y="4" width="7" height="16" rx="1" />
          <path d="M12 12h9" />
          <path d="M16 7l4 5-4 5" />
        </>
      );
    case "split":
      return <path d="M4 12h5l6-6h5M9 12l6 6h5" />;
    case "join":
      return <path d="M4 6h5l6 6h5M9 18l6-6h5" />;
    default:
      return <rect x="4" y="4" width="16" height="16" rx="2" />;
  }
}

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <Glyph category={category} />
    </svg>
  );
}
