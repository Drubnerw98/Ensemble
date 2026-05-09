import type { ResonanceProfileSnapshot } from "../types/profile";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Read at call time so tests / preview builds can stub the env var without
// fighting module load order.
function getApiBase(): string {
  return import.meta.env.VITE_RESONANCE_API_URL ?? "";
}

interface RawProfileExport {
  profile: {
    themes: { label: string; weight: number }[];
    archetypes: { label: string }[];
  };
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
  const raw = (await res.json()) as RawProfileExport;
  return {
    themes: raw.profile.themes.map((t) => ({
      label: t.label,
      weight: t.weight,
    })),
    archetypes: raw.profile.archetypes.map((a) => ({ label: a.label })),
  };
}
