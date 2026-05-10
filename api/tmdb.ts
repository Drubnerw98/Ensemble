import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "@clerk/backend";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!clerkSecretKey || !upstashUrl || !upstashToken) {
  throw new Error(
    "CLERK_SECRET_KEY, UPSTASH_REDIS_REST_URL, and UPSTASH_REDIS_REST_TOKEN must be set in the environment",
  );
}

// Same Upstash instance and pattern as liveblocks-auth.ts. Limits are higher
// here because autocomplete fires per-keystroke (debounced) so a normal
// session legitimately spends more requests against TMDB than against
// Liveblocks token mint. A signed-in user otherwise drains TMDB quota and
// Vercel function budget.
const redis = new Redis({ url: upstashUrl, token: upstashToken });
const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "ensemble:tmdb:ip",
  analytics: false,
});
const userLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ensemble:tmdb:user",
  analytics: false,
});

const PROD_ORIGIN = "https://ensemble-sigma.vercel.app";
const PREVIEW_PATTERN =
  /^https:\/\/ensemble-sigma-[a-z0-9-]+-drubnerw98\.vercel\.app$/;
const LOCAL_PATTERN = /^http:\/\/localhost(:\d+)?$/;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (origin === PROD_ORIGIN) return true;
  if (PREVIEW_PATTERN.test(origin)) return true;
  if (process.env.NODE_ENV !== "production" && LOCAL_PATTERN.test(origin)) {
    return true;
  }
  return false;
}

// Shape returned to the client. Genres/runtime are out of scope — title,
// year, poster, and tmdbId are sufficient for this push.
export type TmdbResult = {
  tmdbId: number;
  title: string;
  year: number | null;
  // Full CDN URL built from TMDB's poster_path. Null when TMDB has no poster.
  posterUrl: string | null;
  mediaType: "movie" | "tv";
};

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

// Raw shape from TMDB search/multi for movie and tv results only.
type TmdbRawResult = {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
};

function mapResult(raw: TmdbRawResult): TmdbResult | null {
  if (raw.media_type === "person") return null;

  const title = raw.title ?? raw.name ?? "";
  if (!title) return null;

  const dateStr =
    raw.media_type === "movie" ? raw.release_date : raw.first_air_date;
  const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) || null : null;

  const posterUrl = raw.poster_path ? `${POSTER_BASE}${raw.poster_path}` : null;

  return {
    tmdbId: raw.id,
    title,
    year,
    posterUrl,
    mediaType: raw.media_type,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const contentType = req.headers["content-type"];
  if (!contentType || !contentType.includes("application/json")) {
    return res.status(415).json({ error: "Unsupported media type" });
  }

  if (!isAllowedOrigin(req.headers.origin as string | undefined)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Per-IP rate limit before any external call (Clerk verify, TMDB fetch).
  // Refuses the request rather than running it and failing to record.
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
      ?.split(",")[0]
      ?.trim() ?? "unknown";
  const ipCheck = await ipLimiter.limit(ip);
  if (!ipCheck.success) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  const sessionToken = authHeader.slice("Bearer ".length);

  let userId: string;
  try {
    const verified = await verifyToken(sessionToken, {
      secretKey: clerkSecretKey,
    });
    userId = verified.sub;
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }

  // Per-user rate limit, layered with per-IP. Same Upstash instance as
  // liveblocks-auth so the per-deployment quota is shared, but separate
  // prefixes mean the two endpoints don't share a counter.
  const userCheck = await userLimiter.limit(userId);
  if (!userCheck.success) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const body = req.body as { query?: unknown } | undefined;
  const query = body?.query;
  if (typeof query !== "string" || query.length < 2 || query.length > 100) {
    return res.status(400).json({ error: "query must be 2–100 characters" });
  }

  // Graceful degrade when the key hasn't been provisioned yet. The
  // autocomplete will simply show no results, preserving the freeform path.
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) {
    console.log("[tmdb] TMDB_API_KEY not set — returning empty results");
    return res.status(200).json({ results: [] });
  }

  const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;

  let tmdbData: { results?: TmdbRawResult[] };
  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${tmdbKey}` },
    });
    if (!upstream.ok) {
      console.warn(
        `[tmdb] Upstream returned ${upstream.status} for query "${query}"`,
      );
      return res.status(200).json({ results: [] });
    }
    tmdbData = (await upstream.json()) as { results?: TmdbRawResult[] };
  } catch (err) {
    console.warn("[tmdb] Network error fetching from TMDB:", err);
    return res.status(200).json({ results: [] });
  }

  const raw = tmdbData.results ?? [];
  const results: TmdbResult[] = [];
  for (const item of raw) {
    if (results.length >= 8) break;
    const mapped = mapResult(item);
    if (mapped) results.push(mapped);
  }

  return res.status(200).json({ results });
}
