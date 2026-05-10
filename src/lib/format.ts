import type { UserInfo } from "./types";

export function formatMeta(type: string, year: number | null): string | null {
  const parts: string[] = [];
  if (type !== "unknown") parts.push(type);
  if (year !== null) parts.push(String(year));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatPullers(
  ids: readonly string[],
  userInfoById: ReadonlyMap<string, UserInfo>,
): string | null {
  if (ids.length === 0) return null;
  const names = ids.map((id) => userInfoById.get(id)?.name ?? "Anonymous");
  if (names.length === 1) return `added by ${names[0]}`;
  if (names.length === 2) return `added by ${names[0]} and ${names[1]}`;
  return `added by ${names[0]} and ${names.length - 1} others`;
}
