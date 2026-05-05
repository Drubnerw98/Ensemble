// Narrow client-side mirror of Resonance's TasteProfile shape — only the
// fields Ensemble currently consumes. Resonance returns more (library,
// recommendations, mediaAffinities, etc.); we widen this type as later
// steps actually need them, instead of dragging the full surface in now.

export interface TasteTheme {
  label: string;
  weight: number;
}

export interface TasteArchetype {
  label: string;
}

export interface ResonanceProfileSnapshot {
  themes: TasteTheme[];
  archetypes: TasteArchetype[];
}
