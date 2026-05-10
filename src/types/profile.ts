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
}

export interface ResonanceProfileSnapshot {
  themes: TasteTheme[];
  archetypes: TasteArchetype[];
  library: ResonanceItem[];
  recommendations: ResonanceItem[];
}
