import { pick, type Locale } from "@/lib/strings";
import type { Cells } from "@/lib/saudiGrid";
import type { Criterion, Grid } from "@/lib/tiki";

function Badge({ c }: { c: Criterion }) {
  if (c.kind !== "club") return <span className="text-2xl leading-none">{c.icon}</span>;
  return (
    <span dir="ltr" className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black" style={{ background: c.c1, color: c.c2, border: `1px solid ${c.c2}44` }}>
      {c.short}
    </span>
  );
}

function Header({ c, locale }: { c: Criterion; locale: Locale }) {
  return (
    <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl bg-white p-1 text-center shadow-sm">
      <Badge c={c} />
      <span className="line-clamp-2 text-[11px] font-bold leading-tight text-[#56645c]">{pick(c, locale)}</span>
    </div>
  );
}

function Square({ names, shown }: { names: string[]; shown: (name: string) => string }) {
  const last = names[names.length - 1];
  if (!last) return <div className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-[#d5dbd6] bg-white text-xl text-[#c3c9d3]">+</div>;
  return (
    <div className="flex aspect-square flex-col items-center justify-center rounded-2xl bg-[#ddf5e4] p-1 text-center">
      <span className="text-3xl font-black leading-none text-[#14532d]">{names.length}</span>
      <span className="mt-1 w-full truncate text-[11px] font-bold">{shown(last)}</span>
    </div>
  );
}

export function SaudiGridBoard({ grid, cells, locale, shown }: { grid: Grid; cells: Cells; locale: Locale; shown: (name: string) => string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,1fr))] gap-1.5">
      <div />
      {grid.cols.map((c) => <Header key={c.id} c={c} locale={locale} />)}
      {grid.rows.flatMap((r, ri) => [
        <Header key={r.id} c={r} locale={locale} />,
        ...grid.cols.map((c, ci) => <Square key={`${r.id}-${c.id}`} names={cells[ri * 3 + ci]} shown={shown} />),
      ])}
    </div>
  );
}
