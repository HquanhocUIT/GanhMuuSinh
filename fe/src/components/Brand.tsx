export function BrandMark({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="currentColor" />
      <g stroke="#f6d79e" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 23q20-11 40 0M19 21l-9 24h20l-11-24m26 0-11 24h20l-9-24M10 45q10 16 20 0m4 0q10 16 20 0M32 18v33" />
      </g>
    </svg>
  );
}
export function PassportStamp({ index = 0, locked = false }: { index?: number; locked?: boolean }) {
  return (
    <div
      className={`passport-stamp stamp-${index % 3} ${locked ? 'stamp-locked' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" fill="none">
        <circle
          cx="50"
          cy="50"
          r="43"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <circle cx="50" cy="50" r="37" stroke="currentColor" />
        <path
          d="M26 48h48c-2 17-10 24-24 24S28 65 26 48ZM23 45h54M37 33c-8-6 7-8 0-14m13 14c-8-6 7-8 0-14m13 14c-8-6 7-8 0-14M36 79h28"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <text
          x="50"
          y="93"
          textAnchor="middle"
          fontSize="6"
          fill="currentColor"
          letterSpacing="1.5"
        >
          CHẠM VỊ
        </text>
      </svg>
    </div>
  );
}
