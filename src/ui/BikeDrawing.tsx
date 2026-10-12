// Generic side profile until the per-bike drawings phase. Flat two-tone panels, all parts connected.
export function BikeDrawing({ label }: { label: string }) {
  return (
    <svg class="drawing" viewBox="0 0 400 200" role="img" aria-label={`${label} (generic drawing)`}>
      <g fill="#2b2b30">
        <circle cx="90" cy="148" r="40" />
        <circle cx="312" cy="148" r="40" />
      </g>
      <g fill="#d9d9de">
        <circle cx="90" cy="148" r="27" />
        <circle cx="312" cy="148" r="27" />
      </g>
      <path d="M90 148 L170 108 L250 112 L312 148" stroke="#6b6b73" stroke-width="7" fill="none" stroke-linejoin="round" />
      <path d="M262 62 L312 148" stroke="#6b6b73" stroke-width="8" stroke-linecap="round" />
      <path d="M120 100 Q150 72 205 72 L250 74 Q262 60 292 58 L312 70 L300 112 L250 120 L170 116 Z" fill="#c8102e" />
      <path d="M170 116 L250 120 L262 140 L190 142 Z" fill="#9e0b22" />
      <path d="M182 74 Q215 56 248 70 L246 84 L184 86 Z" fill="#9e0b22" />
      <path d="M60 92 L120 100 L150 92 L96 84 Z" fill="#c8102e" />
      <path d="M150 92 L196 88" stroke="#2b2b30" stroke-width="6" stroke-linecap="round" />
    </svg>
  );
}
