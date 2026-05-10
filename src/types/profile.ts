// Narrow client-side mirror of Resonance's TasteProfile shape. Widened
// in the Resonance candidate population pass to expose library and
// recommendations alongside themes and archetypes.

export interface TasteTheme {
  label: string;
  weight: number;
}

export interface TasteArchetype {
  label: string;
}

export interface ResonanceItem {
  title: string;
  type?: string;
  year?: number;
  // Resonance tags items with paraphrased taste labels (e.g. "interior
  // fracture", "burden carrying"). Used by the cross-attribution
  // matcher to find which OTHER members' theme/archetype labels also
  // describe a candidate. Optional so legacy fixtures and lo-fi manual
  // entries (which carry no tags) parse cleanly.
  tasteTags?: string[];
}

export interface ResonanceProfileSnapshot {
  themes: TasteTheme[];
  archetypes: TasteArchetype[];
  library: ResonanceItem[];
  recommendations: ResonanceItem[];
}
