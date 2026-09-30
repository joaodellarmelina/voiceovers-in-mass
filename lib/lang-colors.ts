/** Stable, soft color per language column (by position). Full class names so Tailwind picks them up. */
const PALETTE = [
  { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  { chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  { chip: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500" },
  { chip: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  { chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  { chip: "bg-teal-50 text-teal-700 ring-teal-200", dot: "bg-teal-500" },
  { chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  { chip: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200", dot: "bg-fuchsia-500" },
];

export function langColor(index: number) {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}
