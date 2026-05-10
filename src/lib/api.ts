import type {
  ResonanceItem,
  ResonanceProfileSnapshot,
} from "../types/profile";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getApiBase(): string {
  return import.meta.env.VITE_RESONANCE_API_URL ?? "";
}

interface RawProfileItem {
  title?: unknown;
  // Resonance ships items with `mediaType`. Earlier we mistakenly read
  // `type`, which silently dropped every item. Keep both keys parsable
  // so future renames or legacy fixtures still work.
  mediaType?: unknown;
  type?: unknown;
  year?: unknown;
  tasteTags?: unknown;
}

interface RawProfileExport {
  profile: {
    themes: { label: string; weight: number }[];
    archetypes: { label: string }[];
  };
  // library and recommendations are TOP-LEVEL on Resonance's response,
  // alongside profile (not inside it). Earlier we declared them under
  // profile, which silently produced empty arrays and broke pulls.
  library?: RawProfileItem[];
  recommendations?: RawProfileItem[];
}

export async function fetchMyProfile(
  token: string,
): Promise<ResonanceProfileSnapshot> {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new ApiError("VITE_RESONANCE_API_URL is not configured", 0);
  }
  const res = await fetch(`${apiBase}/api/profile/export`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    let message = `Resonance API returned ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // body wasn't JSON; keep the default
    }
    throw new ApiError(message, res.status);
  }
  const raw = (await res.json()) as unknown;
  return parseProfileExport(raw);
}

// Parse a raw /api/profile/export payload into the narrow snapshot
// Ensemble consumes. Exported so it's directly testable against the
// real Resonance response shape without mocking fetch.
export function parseProfileExport(raw: unknown): ResonanceProfileSnapshot {
  const r = (raw ?? {}) as RawProfileExport;
  return {
    themes: (r.profile?.themes ?? []).map((t) => ({
      label: t.label,
      weight: t.weight,
    })),
    archetypes: (r.profile?.archetypes ?? []).map((a) => ({ label: a.label })),
    library: normalizeItems(r.library),
    recommendations: normalizeItems(r.recommendations),
  };
}

function normalizeItems(raw: RawProfileItem[] | undefined): ResonanceItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ResonanceItem[] = [];
  for (const item of raw) {
    if (typeof item.title !== "string") continue;
    // Prefer mediaType (Resonance's actual field), fall back to type
    // for any legacy callers or future renames.
    const rawType =
      typeof item.mediaType === "string"
        ? item.mediaType
        : typeof item.type === "string"
          ? item.type
          : undefined;
    const tasteTags = Array.isArray(item.tasteTags)
      ? item.tasteTags.filter(
          (t): t is string => typeof t === "string" && t.length > 0,
        )
      : undefined;
    out.push({
      title: item.title,
      type: rawType,
      year: typeof item.year === "number" ? item.year : undefined,
      tasteTags,
    });
  }
  return out;
}
