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

/** Lightweight summary of a Resonance batch — enough for the source picker
 * to render a labeled option. Matches the shape Resonance's
 * /api/recommendations/batches returns. */
export interface ResonanceBatchSummary {
  id: string;
  prompt: string | null;
  name: string | null;
  createdAt: string;
  count: number;
}

interface RawBatchesResponse {
  batches?: {
    id?: unknown;
    prompt?: unknown;
    name?: unknown;
    createdAt?: unknown;
    count?: unknown;
  }[];
}

export async function fetchBatches(
  token: string,
): Promise<ResonanceBatchSummary[]> {
  const raw = await getJson<RawBatchesResponse>(
    "/api/recommendations/batches",
    token,
  );
  if (!Array.isArray(raw.batches)) return [];
  const out: ResonanceBatchSummary[] = [];
  for (const b of raw.batches) {
    if (typeof b.id !== "string") continue;
    out.push({
      id: b.id,
      prompt: typeof b.prompt === "string" ? b.prompt : null,
      name: typeof b.name === "string" ? b.name : null,
      createdAt:
        typeof b.createdAt === "string" ? b.createdAt : new Date().toISOString(),
      count: typeof b.count === "number" ? b.count : 0,
    });
  }
  return out;
}

interface RawRecommendation {
  media?: {
    title?: unknown;
    mediaType?: unknown;
    year?: unknown;
  };
  tasteTags?: unknown;
}

interface RawRecommendationsResponse {
  recommendations?: RawRecommendation[];
}

/** Fetch the recommendations in a single batch. Used when the user picks a
 * specific batch as a pull source — bypasses the blended /api/profile/export
 * payload and surfaces just that batch's items. */
export async function fetchBatchRecommendations(
  token: string,
  batchId: string,
): Promise<ResonanceItem[]> {
  const raw = await getJson<RawRecommendationsResponse>(
    `/api/recommendations?batch=${encodeURIComponent(batchId)}`,
    token,
  );
  if (!Array.isArray(raw.recommendations)) return [];
  const out: ResonanceItem[] = [];
  for (const r of raw.recommendations) {
    const m = r.media ?? {};
    if (typeof m.title !== "string") continue;
    const item: ResonanceItem = { title: m.title };
    if (typeof m.mediaType === "string") item.type = m.mediaType;
    if (typeof m.year === "number") item.year = m.year;
    if (Array.isArray(r.tasteTags)) {
      item.tasteTags = r.tasteTags.filter(
        (t): t is string => typeof t === "string" && t.length > 0,
      );
    }
    out.push(item);
  }
  return out;
}

interface RawLibraryResponse {
  items?: {
    title?: unknown;
    mediaType?: unknown;
    year?: unknown;
    status?: unknown;
  }[];
}

/** Fetch only the user's watchlist library items (status === "watchlist").
 * Filters server-shape client-side because Resonance ships the full library
 * in one payload — fine at portfolio scale, would be a query param later. */
export async function fetchWatchlist(token: string): Promise<ResonanceItem[]> {
  const raw = await getJson<RawLibraryResponse>("/api/library", token);
  if (!Array.isArray(raw.items)) return [];
  const out: ResonanceItem[] = [];
  for (const it of raw.items) {
    if (typeof it.title !== "string") continue;
    if (it.status !== "watchlist") continue;
    const item: ResonanceItem = { title: it.title };
    if (typeof it.mediaType === "string") item.type = it.mediaType;
    if (typeof it.year === "number") item.year = it.year;
    out.push(item);
  }
  return out;
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new ApiError("VITE_RESONANCE_API_URL is not configured", 0);
  }
  const res = await fetch(`${apiBase}${path}`, {
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
  return (await res.json()) as T;
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
