import { cn } from "@/lib/utils";

/**
 * The brand marks (docs/design/logos). Argon: the full outer shell of eight
 * electrons (argon is inert, it never reacts on its own) around a navy core.
 * Argus, the AI: an eye with argon's violet glow as the iris and a navy spark.
 * Lines take the text colour, so both work in light and dark mode.
 */
const navy = "var(--mark-navy, var(--brand-navy, #1e3a8a))";

const SHELL = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => [32 + 22 * Math.sin((deg * Math.PI) / 180), 32 - 22 * Math.cos((deg * Math.PI) / 180)]);

export function ArgonMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-6 shrink-0", className)}>
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".25" />
      {SHELL.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.6" fill="currentColor" />
      ))}
      <circle cx="32" cy="32" r="9" fill={navy} />
    </svg>
  );
}

export function ArgusMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-4 shrink-0", className)}>
      {/* Eye white, then the outline: a soft fill so the eye reads as a shape on any surface. */}
      <path d="M3 34C13 15 51 15 61 34C51 53 13 53 3 34Z" fill="currentColor" fillOpacity=".14" />
      <path d="M3 34C13 15 51 15 61 34C51 53 13 53 3 34Z" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      {/* Iris with a darker rim, a large pupil and two highlights. */}
      <circle cx="32" cy="34" r="13" fill="var(--brand-violet, #7c5cff)" />
      <circle cx="32" cy="34" r="13" fill="none" stroke="#09090b" strokeOpacity=".35" strokeWidth="2" />
      <circle cx="32" cy="34" r="5.6" fill="#09090b" />
      <circle cx="36.4" cy="29.6" r="2.6" fill="#fff" />
      <circle cx="27.8" cy="38.2" r="1.1" fill="#fff" fillOpacity=".8" />
      <path d="M54 1C55 6.4 57.1 8.5 62.5 9.5C57.1 10.5 55 12.6 54 18C53 12.6 50.9 10.5 45.5 9.5C50.9 8.5 53 6.4 54 1Z" fill={navy} />
    </svg>
  );
}
