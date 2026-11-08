import { BORDER_PATH, MAP_H, MAP_W, SPOTS } from "@/lib/wayanadMap";

/**
 * Decorative Wayanad district outline (light-green fill, green border) with dark-green dots for the
 * main tourist spots. Used as the page background and as a small map on package pages.
 * `highlight` lists spot names to emphasise (others are drawn smaller).
 */
export default function WayanadMap({
  className = "",
  labels = false,
  highlight,
}: {
  className?: string;
  labels?: boolean;
  highlight?: string[];
}) {
  const hl = highlight && highlight.length > 0 ? highlight.map((h) => h.toLowerCase()) : null;
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className={className} role="img" aria-label="Map of Wayanad district with tourist spots">
      <path
        d={BORDER_PATH}
        style={{ fill: "var(--map-fill)", stroke: "var(--neon)", filter: "var(--map-glow)" }}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {Object.entries(SPOTS).map(([name, [x, y]]) => {
        // A spot is "on" when an itinerary place mentions its first word (e.g. "Banasura Hills" -> Banasura).
        const key = name.toLowerCase().split(" ")[0];
        const on = !hl || hl.some((h) => h.includes(key));
        return (
          <g key={name}>
            <circle
              cx={x} cy={y} r={on ? 9 : 5}
              style={{ fill: "var(--neon)", stroke: "var(--map-ring)", filter: "var(--map-glow)" }}
              strokeWidth={on ? 2.5 : 1.5}
              opacity={on ? 1 : 0.7}
            />
            {on && <circle cx={x} cy={y} r={16} fill="none" style={{ stroke: "var(--neon)" }} strokeOpacity={0.45} strokeWidth={2} />}
            {labels && on && (
              <text x={x + 14} y={y + 5} fontSize={17} fontWeight={700} paintOrder="stroke" style={{ fill: "var(--map-label)", stroke: "var(--map-label-halo)" }} strokeWidth={4}>
                {name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
