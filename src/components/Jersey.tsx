"use client";

/** Pixel-art style football jersey rendered with pure CSS grid blocks. */
export function Jersey({
  body,
  sleeves,
  numberColor,
  number,
  captain,
  goals,
  faded,
  size = 56,
}: {
  body: string;
  sleeves: string;
  numberColor: string;
  number: number;
  captain?: boolean;
  goals?: number;
  faded?: boolean;
  size?: number;
}) {
  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size * 0.82, opacity: faded ? 0.55 : 1 }}
    >
      {/* sleeves */}
      <div
        className="absolute rounded-sm"
        style={{ left: 0, top: "8%", width: "22%", height: "38%", background: sleeves, border: "2px solid rgba(0,0,0,.65)" }}
      />
      <div
        className="absolute rounded-sm"
        style={{ right: 0, top: "8%", width: "22%", height: "38%", background: sleeves, border: "2px solid rgba(0,0,0,.65)" }}
      />
      {/* body */}
      <div
        className="absolute flex items-center justify-center rounded-sm"
        style={{ left: "16%", top: 0, width: "68%", height: "100%", background: body, border: "2px solid rgba(0,0,0,.65)" }}
      >
        <span
          className="font-bold leading-none"
          style={{ color: numberColor, fontSize: size * 0.34, fontFamily: "var(--font-pixel), monospace", textShadow: "1px 1px 0 rgba(0,0,0,.35)" }}
        >
          {number}
        </span>
      </div>
      {/* collar */}
      <div
        className="absolute"
        style={{ left: "40%", top: 0, width: "20%", height: "10%", background: "rgba(0,0,0,.5)", borderRadius: 2 }}
      />
      {goals ? (
        <div
          className="absolute -right-1 -top-2 flex items-center gap-0.5 text-[11px]"
          title={`${goals} gol`}
        >
          <span>⚽</span>
          {goals > 1 && (
            <span className="rounded bg-sky-600 px-1 text-[9px] font-bold text-white">
              {goals}
            </span>
          )}
        </div>
      ) : null}
      {captain && (
        <div className="absolute -right-1.5 bottom-0 flex h-4 w-4 items-center justify-center rounded-sm border border-black bg-white text-[10px] font-black text-black">
          C
        </div>
      )}
    </div>
  );
}
