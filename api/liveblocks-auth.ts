import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { Liveblocks } from "@liveblocks/node";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Same alphabet as src/lib/sessionCode.ts. Duplicated intentionally so the
// serverless function stays self-contained — if you change one, change both.
const SESSION_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const liveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY;
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!clerkSecretKey || !liveblocksSecret || !upstashUrl || !upstashToken) {
  throw new Error(
    "CLERK_SECRET_KEY, LIVEBLOCKS_SECRET_KEY, UPSTASH_REDIS_REST_URL, and UPSTASH_REDIS_REST_TOKEN must be set in the environment",
  );
}

const liveblocks = new Liveblocks({ secret: liveblocksSecret });
const clerk = createClerkClient({ secretKey: clerkSecretKey });

const redis = new Redis({ url: upstashUrl, token: upstashToken });
// 5/min/IP catches enumeration probes; 30/min/user accommodates legit
// multi-tab + disconnect-rejoin patterns while throttling a malicious
// account. A valid Clerk session token issued for any of Resonance /
// Constellation / Ensemble (shared OAuth instance) would otherwise let
// any caller mint Liveblocks room tokens at will.
const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "ensemble:liveblocks-auth:ip",
  analytics: false,
});
const userLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ensemble:liveblocks-auth:user",
  analytics: false,
});

// Origin allowlist. Browsers always send Origin on POST; a missing Origin
// is treated as suspicious (server-to-server caller) and rejected.
// Localhost only allowed outside production builds.
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

  // Per-IP rate limit before any external call (Clerk verify, Clerk lookup,
  // Liveblocks session). Refuses the request rather than running it and
  // failing to record.
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

  // Server-verifies the Clerk session — we don't trust the client's claim
  // about identity OR the room they want to join.
  let userId: string;
  try {
    const verified = await verifyToken(sessionToken, {
      secretKey: clerkSecretKey,
    });
    userId = verified.sub;
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }

  // Per-user rate limit, layered with per-IP. Corporate NAT can't lock out
  // legit users behind one IP; a single malicious Clerk account can't
  // multiplex past its own quota.
  const userCheck = await userLimiter.limit(userId);
  if (!userCheck.success) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const body = req.body as { room?: unknown } | undefined;
  const room = body?.room;
  if (typeof room !== "string" || !SESSION_CODE_PATTERN.test(room)) {
    return res.status(400).json({ error: "Invalid room code" });
  }

  // Pull display info so other members in the room see a real name + avatar
  // via Liveblocks' UserMeta. Failure here isn't fatal — fall back to a
  // placeholder so a transient Clerk hiccup doesn't block joining.
  let userInfo: { name: string; avatarUrl?: string };
  try {
    const user = await clerk.users.getUser(userId);
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      "Anonymous";
    userInfo = { name: displayName, avatarUrl: user.imageUrl };
  } catch {
    userInfo = { name: "Anonymous" };
  }

  const session = liveblocks.prepareSession(userId, { userInfo });
  session.allow(room, session.FULL_ACCESS);
  const { body: tokenBody, status } = await session.authorize();
  return res.status(status).send(tokenBody);
}
