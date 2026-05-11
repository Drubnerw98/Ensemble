interface Props {
  size?: number;
}

/**
 * Brand glyph for Ensemble. Three small nodes at the corners of an
 * equilateral triangle, each linked to a larger central filled point by
 * a thin stroke — visualizes "multiple sources converging on a shared
 * decision." Mirrors the visual language of Constellation's asterism
 * (small circles + hairline connecting lines) so the three sibling apps
 * read as one family while their motifs stay distinct: ripples (Resonance),
 * scattered stars (Constellation), convergence (Ensemble).
 *
 * Renders in currentColor so consumers can theme it via Tailwind text
 * utilities (typically `text-accent` for the saffron variant).
 */
export function ConvergenceGlyph({ size = 22 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      {/* Convergence lines from each corner node to the center. Thin and
          half-opacity so the structure is implied without dominating. */}
      <line
        x1="16"
        y1="7"
        x2="16"
        y2="14"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeOpacity="0.55"
      />
      <line
        x1="7.5"
        y1="22"
        x2="14"
        y2="18"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeOpacity="0.55"
      />
      <line
        x1="24.5"
        y1="22"
        x2="18"
        y2="18"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeOpacity="0.55"
      />
      {/* Three corner nodes — small, equal radius. */}
      <circle cx="16" cy="6" r="1.7" fill="currentColor" />
      <circle cx="6.5" cy="23.5" r="1.7" fill="currentColor" />
      <circle cx="25.5" cy="23.5" r="1.7" fill="currentColor" />
      {/* Convergence point — larger and filled so the eye lands on the
          decision being made. */}
      <circle cx="16" cy="16" r="2.6" fill="currentColor" />
    </svg>
  );
}
