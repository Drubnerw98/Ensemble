import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { Liveblocks } from "@liveblocks/node";

// Same alphabet as src/lib/sessionCode.ts. Duplicated intentionally so the
// serverless function stays self-contained — if you change one, change both.
const SESSION_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const liveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY;

if (!clerkSecretKey || !liveblocksSecret) {
  throw new Error(
    "CLERK_SECRET_KEY and LIVEBLOCKS_SECRET_KEY must be set in the environment",
  );
}

const liveblocks = new Liveblocks({ secret: liveblocksSecret });
const clerk = createClerkClient({ secretKey: clerkSecretKey });

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
