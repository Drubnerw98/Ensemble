// Client-side helpers for TMDB search via the /api/tmdb serverless proxy.
// The proxy handles auth and key hiding; this module handles token forwarding
// and graceful degradation (any error returns [] so callers don't need to
// handle thrown exceptions from search).

export type TmdbResult = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  mediaType: "movie" | "tv";
};

// Calls /api/tmdb with the user's Clerk session token. Returns an empty
// array on any error — network failure, 401, non-OK status — so callers
// can treat the result as "no suggestions" rather than an error state.
export async function searchTmdb(
  query: string,
  token: string,
): Promise<TmdbResult[]> {
  try {
    const res = await fetch("/api/tmdb", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      console.warn(`[tmdb] /api/tmdb returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { results?: TmdbResult[] };
    return data.results ?? [];
  } catch (err) {
    console.warn("[tmdb] searchTmdb failed:", err);
    return [];
  }
}

// Pick the best TMDB match for a title+type+year from a result list.
// Preference order: matching mediaType, then closest year, then first result.
// Returns null if results is empty.
export function pickBestMatch(
  results: TmdbResult[],
  preferredMediaType: "movie" | "tv" | null,
  preferredYear: number | null,
): TmdbResult | null {
  if (results.length === 0) return null;

  // Narrow to type-matching results if possible; fall back to all.
  const typeMatches =
    preferredMediaType !== null
      ? results.filter((r) => r.mediaType === preferredMediaType)
      : results;
  const pool = typeMatches.length > 0 ? typeMatches : results;

  // Among pool, prefer closest year if we have a reference year.
  if (preferredYear !== null) {
    let best = pool[0];
    let bestDiff = best.year !== null ? Math.abs(best.year - preferredYear) : Infinity;
    for (let i = 1; i < pool.length; i++) {
      const diff =
        pool[i].year !== null
          ? Math.abs(pool[i].year! - preferredYear)
          : Infinity;
      if (diff < bestDiff) {
        best = pool[i];
        bestDiff = diff;
      }
    }
    return best;
  }

  return pool[0];
}
