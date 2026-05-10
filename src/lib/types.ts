// Display info attached to a Liveblocks member via UserMeta. Populated
// server-side by api/liveblocks-auth.ts from Clerk; never user-supplied
// at runtime, so the fields are optional only because the Anonymous
// fallback path in the auth function omits avatarUrl.
export type UserInfo = { name?: string; avatarUrl?: string };
