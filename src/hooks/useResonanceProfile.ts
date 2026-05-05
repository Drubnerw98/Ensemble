import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  ApiError,
  fetchMyProfile,
} from "../lib/api";
import type { ResonanceProfileSnapshot } from "../types/profile";

export type ProfileStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; data: ResonanceProfileSnapshot }
  | { state: "no-profile" }
  | { state: "error"; message: string };

type FetchResult =
  | { state: "loading" }
  | { state: "ready"; data: ResonanceProfileSnapshot }
  | { state: "no-profile" }
  | { state: "error"; message: string };

export function useResonanceProfile(): ProfileStatus {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [fetched, setFetched] = useState<FetchResult | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetched({ state: "loading" });
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) setFetched(null);
          return;
        }
        const data = await fetchMyProfile(token);
        if (!cancelled) setFetched({ state: "ready", data });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setFetched({ state: "no-profile" });
            return;
          }
          setFetched({ state: "error", message: err.message });
          return;
        }
        // Browser-vendor-specific TypeError on network/CORS/DNS failure.
        // Normalize so the banner is consistent.
        setFetched({ state: "error", message: "Resonance is unreachable" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded) return { state: "idle" };
  if (!isSignedIn) return { state: "idle" };
  return fetched ?? { state: "loading" };
}
